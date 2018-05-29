/**
Copyright 2018 LGS Innovations

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
**/

(() => {
  'use strict';

  const CrudManager = require('../helpers/crud-manager');
  const logger = require('../logging/logger-factory').getLogger();
  const ModuleClusterService = require('./module-cluster-service');
  const DispatchApi = require('../dispatcher/dispatch-api');
  const KeyValueService = require('../helpers/key-value-service');
  const path = require('path');
  const Graph = require('graph-js');
  const express = require('express');

  const InfrastureMessenger = require('./module-management-messenger');

  const UtilFs = require('./../helpers/fs');

  const ROOT_DIR = path.resolve(__dirname, '../..');
  const MODULE_LOAD_TIMEOUT = 120 * 1000;
  const TAG = 'base#ModuleManager';
  const PROGRESS_TAG = 'base#ModuleManager#Status';

  const KEY = {
    LOAD_STATUS: 'load-status',
    IDLE: 'idle',
    LOADING: 'loading',
    UNLOADING: 'unloading'
  };

  const DEFAULT_PROGRESS_STATUS = {
    status: KEY.IDLE,
  };

  class ModuleManager extends CrudManager {
    constructor(scopeManager, cryptoManager, userManager, loggingManager, galleryItemManager, widgetManager, pageItemManager) {
      super(TAG, {readScopes: ['base'], writeScopes: ['base'], Messenger: require('./module-messenger')});
      this._scopesManager = scopeManager;
      this._cryptoManager = cryptoManager;
      this._userManager = userManager;
      this._loggingManager = loggingManager;
      this._galleryItemManager = galleryItemManager;
      this._widgetManager = widgetManager;
      this._pageItemManager = pageItemManager;

      this._clusterService = new ModuleClusterService(this);
      this._infrastructureMessenger = new InfrastureMessenger(this);
      this._progressService = new KeyValueService({tag: PROGRESS_TAG, readScopes: ['base']})

      this._rootDataDir = global.paths.data;
      this._modulesRootDir = path.resolve(this._rootDataDir, 'base/modules');
      this._modulesPackegesDir = path.resolve(this._modulesRootDir, 'modules-packages');
      this._modulesPackagesDecryptedDir = path.resolve(this._modulesPackegesDir, 'decrypted');
      this._modulesDir = path.resolve(this._modulesRootDir, 'modules');
      this._upgradeDir = path.resolve(global.paths.data, 'upgrades');
      this._modulesUploadDir = path.resolve(this._modulesPackegesDir, 'tmp');

      this._statusPromise = null;
    }

    load(messageCenter, baseServer) {
      this._messageCenter = messageCenter;
      this._baseServer = baseServer;
      this._dispatchApi = new DispatchApi(messageCenter);

      logger.debug('Loading the module manager');
      return super.load(messageCenter, baseServer)
      .then(() => this._clusterService.load(messageCenter))
      .then(() => this._infrastructureMessenger.load(messageCenter))
      .then(() => this._progressService.load(messageCenter))
      .then(() => this._progressService.getManager().set({key: KEY.LOAD_STATUS, value: DEFAULT_PROGRESS_STATUS}))
      .then(() => this._initDataDir())
      .then(() => this._readInstalledBase())
      .then(() => this._readModules())
      .then(() => this.loadModules())
      .then(() => logger.debug('Modules have finished loading'));
    }

    unload(messageCenter) {
      return Promise.resolve()
      .then(() => this._progressService.unload())
      .then(() => this._infrastructureMessenger.unload())
      .then(() => this._clusterService.unload())
      .then(() => super.unload(messageCenter));
    }

    create() {
      return Promise.reject(new Error('operation-not-supported'));
    }
    update() {
      return Promise.reject(new Error('operation-not-supported'));
    }
    delete() {
      return Promise.reject(new Error('operation-not-supported'));
    }

    getDataDirectory(moduleName) {
      // If the moduleName is not provided just return the data directory path

      if ('string' !== typeof(moduleName)) {
        return Promise.resolve(this._rootDataDir);
      }

      // This is the list of reserved names
      let reservedNames = ['base', 'bin', 'bin32', 'binarm', 'db', 'decrypted', 'encrypted'];

      // Make sure the moduleName is not a reserved name
      if (reservedNames.some((reservedName) => reservedName === moduleName)) {
        return Promise.reject(new Error(moduleName + ' is a reserved name'));
      }

      // Get the module for this moduleName
      let mod = this._getModuleFromName(moduleName);

      // Make sure the module name is a module in the module list
      if (!mod) {
        return Promise.reject(new Error('no module with name ' + moduleName));
      }

      // Create the data directory path for the module
      let dirpath = path.resolve(this._rootDataDir, mod.name);

      // Create the directory
      return UtilFs.mkdir(dirpath)
      .then(null, (err) => {
        // Check if this is a 'EEXIST' error
        if (-17 === err.errno && 'EEXIST' === err.code) {
          // Safe to ignore
          logger.debug('Ignoring EEXIST error when creating a data directory for %s', moduleName);
        } else {
          return Promise.reject(err);
        }
      })
      .then(() => dirpath);
    }

    loadModules() {
      if (this._statusPromise) {
        return this._statusPromise;
      }
      this._statusPromise = Promise.resolve()
      .then(() => this._progressService.getManager().set({key: KEY.LOAD_STATUS, value: {status: KEY.LOADING}}))
      .then(() => super.list())
      .then((mods) => {
        const graph = this._generateDependencyGraph(mods.map((mod) => mod)); // 1 level Deep Copy
        return this._loadModuleGrouping(graph);
      })
      .catch((err) => {
        logger.error('Error loading modules', err);
      })
      .then(() => this._progressService.getManager().set({key: KEY.LOAD_STATUS, value: DEFAULT_PROGRESS_STATUS}))
      .catch((err)=> {
        logger.error('Error setting status', err);
        return Promise.reject(new Error('internal-error'));
      })
      .then(() => {
        this._statusPromise = null;
      });
      return this._statusPromise;
    }

    moduleCrashed(id) {
      const mod = this._items.find((mod) => mod.id === id);
      if (!mod) {
        logger.error('Unknown module crashed. Unable to clean up');
        return;
      }

      return this.unloadModule(mod)
      .then(() => super.update(mod.id, {loadError: {message: 'Module crashed without warning'}}))
      .catch((err) => super.unload(mod.id, {loadError: {message: 'Module crashed and we could not clean it up ' + err.message}}));
    }

    unloadModule(mod) {
      logger.debug('Request to unload module');
      return super.list()
      .then((allModules) => {
        const graph = this._generateDependencyGraph(allModules.map((mod) => mod)); // 1 level Deep Copy
        return this._unloadModuleGrouping(graph, mod);
      })
      // TODO remove original modules
      .then(() => {
        console.log('Whoop we are done unloading');
      })
      .catch((err) => {
        logger.error('Error unloading modules', err);
      });
    }

    _loadModuleGrouping(graph) {
      const mods = {};
      return new Promise((resolve, reject) => {
        const dispatchModuleChain = () => {
          let chain = Promise.resolve();

          const modulesToLoad = this._computeModulesToLoadNext(graph).filter((mod) => mod.id !== 'DNE' && !mods.hasOwnProperty(mod.id));

          // Base Case is if there are no more modules to load
          if (modulesToLoad.length === 0 && Object.keys(mods).length === 0) {
            resolve(chain);
          }
          modulesToLoad.forEach((modNode) => {
            const moduleId = modNode.id;
            mods[moduleId] = Promise.resolve()
            .then(() => super.get(moduleId))
            .then((mod) => this._loadModule(mod))
            .then((mod) => {
              delete mods[moduleId];
              graph.removeNode(moduleId);
              return dispatchModuleChain();
            })
            .catch((err) => {
              logger.error('Error loading module %s with id %d', modNode.name, modNode.id, err);
              return super.update(moduleId, {loadError: {message: err.message}});
            })
            .catch((err) => {
              logger.error('Unable to set the error reason for the load error', err);
            });
            chain = chain.then(() => mods[moduleId]);
          });
          return chain;
        };
        dispatchModuleChain(); // Initial call
      })
      // Mark all unloaded modules as missing a dependency
      .then(() => super.list())
      .then((modules) => {
        return Promise.all(modules.map((module) => {
          if (module.isLoaded === false && !module.hasOwnProperty('loadError')) {
            return super.update(module.id, {loadError: {message: 'Missing Dependency'}});
          } else {
            return Promise.resolve();
          }
        }));
      })
      .then(() => super.list());
    }

    _computeModulesToLoadNext(graph) {
      const allModuleNodes = graph.getNodes().reduce((acc, modNode) => {
        acc[modNode.getId()] = modNode;
        return acc;
      }, {});

      graph.getEdges().forEach((edge) => {
        delete allModuleNodes[edge.getNodeStart().getId()];
      });

      return Object.keys(allModuleNodes).map((id) => {
        return allModuleNodes[id].getContent();
      });
    }

    _loadModule(mod) {
      logger.debug('Loading module %s with id %d', mod.name, mod.id);

      if (mod.isLoaded) {
        return Promise.resolve(mod);
      }
      const start = process.hrtime();
      return Promise.resolve()
      .then(() => this._checkModuleDependenciesAreLoaded(mod))
      .then(() => this._loadModuleAppDirectory(mod))
      .then(() => this._setModuleScopes(mod))
      .then(() => {
        return new Promise((resolve, reject) => {
          const cleanUp = () => {
            clearTimeout(moduleTimeout);
            this._clusterService.removeListener('failed-load', loadError);
            this._infrastructureMessenger.removeListener('module-response', moduleResponse);
          };
          const timeoutFunc = () => {
            cleanUp();
            reject(new Error('Module Load Timeout'));
          };

          const loadError = (deadModule) => {
            if (deadModule.id === mod.id) {
              cleanUp();
              reject(new Error('Module crashed during load - unknown reason'));
            }
          };

          const moduleResponse = (responseMod, err, result) => {
            if (responseMod.id === mod.id) {
              cleanUp();
              if (err) {
                reject(err);
              } else {
                resolve(result);
              }
            }
          };
          const moduleTimeout = setTimeout(timeoutFunc, MODULE_LOAD_TIMEOUT);
          this._clusterService.on('failed-load', loadError);
          this._infrastructureMessenger.on('module-response', moduleResponse);

          this._clusterService.summonTheModule(mod)
          .catch((err) => {
            logger.error('Something went wrong during spawn ', err);
            reject(err);
          });
        });
      })
      .then(() => {
        const diff = process.hrtime(start);
        const duration = Math.floor((diff[0] * 1e9 + diff[1]) / 1e6);
        logger.debug('Loaded module %s', mod.name, {
          name: mod.name,
          version: mod.version,
          duration: duration
        });
      })
      .then(() => this._addPageItem(mod))
      .then(() => this._addGalleryItem(mod))
      .then(() => this._addWidgets(mod))
      .then(() => this._clusterService.moduleCompletedLoad(mod))
      .then(() => super.update(mod.id, {isLoaded: true, loadError: null}))
      .catch((err) => {
        return this._clusterService.destroyTheModule(mod)
        .then(() => Promise.reject(err));
      });
    }

    _unloadModuleGrouping(graph, mod, visited={}) {
      const node = graph.getNodes().find((node) => node.getId() === mod.id);
      if (visited.hasOwnProperty(mod.id)) {
        return visited[mod.id];
      }
      visited[mod.id] = Promise.resolve()
      .then(() => {
        const dependentChildren = this._computeDependents(graph, node.getContent());
        if (dependentChildren.length !== 0) {
          return Promise.all(dependentChildren.map((child) => this._unloadModuleGrouping(graph, child, visited)));
        } else {
          return Promise.resolve();
        }
      })
      .then(() => this._unloadModule(mod));
      return visited[mod.id];
    }

    _unloadModule(modToUnload) {
      const mod = this._items.find((item) => item.id === modToUnload.id); // Need to do this so I can get the exact state of the module
      if (!mod.isLoaded) {
        return Promise.resolve();
      }
      return Promise.resolve()
      .then(() => this._checkModuleDependenciesAreUnloaded(mod))
      .then(() => this._clusterService.moduleUnloading(mod))
      .then(() => {
        return new Promise((resolve, reject) => {
          const cleanUp = () => {
            clearTimeout(timeout);
          };
          const timeoutFunc = () => {
            cleanUp();
            reject(new Error('Module Unload Timeout'));
          };

          const moduleUnloadedFunc = (mod) => {
            if (mod.id === modToUnload.id) {
              cleanUp();
              resolve(mod);
            }
          };
          this._clusterService.on('module-unloaded', moduleUnloadedFunc);
          const timeout = setTimeout(timeoutFunc, MODULE_LOAD_TIMEOUT);

          this._dispatchApi.die(mod)
          .then((result) => {
            cleanUp();
            resolve(result);
          })
          .catch((err) => {
            logger.error(`Unable to unload module ${mod.name} note: this error is normal, if you see it once, if the module crashed. We obviously can not clean it up properly if it is already dead`, err);
            logger.error('Killing module anyway');
            cleanUp();
            resolve();
          });
        })
        .catch((err) => {
          logger.error('Somthing happened during unload... Continuing anyway', err);
          return Promise.resolve();
        });
      })
      .then(() => this._clusterService.destroyTheModule(mod)) // If the module is still running its dead now
      .then(() => {
        logger.debug('Module Process is dead');
      })
      .then(() => this._unloadModuleAppDirectory(mod))
      .then(() => this._removeGalleryItem(mod))
      .then(() => this._removePageItem(mod))
      .then(() => this._removeWidgets(mod))
      .catch((err) => {
        logger.error('Whoopsies Going to kill the module anyway', err);
      })
      .then(() => super.update(mod.id, {isLoaded: false})) // If this fails nothing can unload
      .then((result) => {
        logger.info(`${mod.name} has been unloaded`);
        return result;
      });
    }

    _computeDependents(graph, mod) {
      const dependents = [];
      graph.getEdges().forEach((edge) => {
        if (edge.getNodeEnd().getId() === mod.id) {
          dependents.push(edge.getNodeStart().getContent());
        }
      });
      return dependents;
    }

    _initDataDir() {
      return UtilFs.mkdir(this._modulesRootDir).catch((err) => {
        if (err.code !== 'EEXIST') {
          return Promise.reject(err);
        }
      }) // Mkdir if not exists
      .then(() => UtilFs.mkdir(this._modulesPackegesDir)).catch((err) => {
        if (err.code !== 'EEXIST') {
          return Promise.reject(err);
        }
      }) // Mkdir if not exists
      .then(() => UtilFs.mkdir(this._modulesPackagesDecryptedDir)).catch((err) => {
        if (err.code !== 'EEXIST') {
          return Promise.reject(err);
        }
      }) // Mkdir if not exists
      .then(() => UtilFs.mkdir(this._modulesDir)).catch((err) => {
        if (err.code !== 'EEXIST') {
          return Promise.reject(err);
        }
      }) // Mkdir if not exists
      .then(() => UtilFs.mkdir(this._modulesUploadDir)).catch((err) => {
        if (err.code !== 'EEXIST') {
          return Promise.reject(err);
        }
      }); // Mkdir if not exists
    }

    _addGalleryItem(mod) {
      if (mod.icon && mod.displayName) {
        const galleryItem = {
          title: mod.displayName,
          icon: mod.icon,
          category: mod.category,
          href: `/${mod.name}`,
          scopes: mod.scopes.map((scope) => scope.name)
        };
        return this._galleryItemManager.create(galleryItem)
        .then((galleryItem) => {
          mod.galleryId = galleryItem.id;
          return mod;
        });
      } else {
        return mod;
      }
    }

    _removeGalleryItem(mod) {
      if (mod.hasOwnProperty('galleryId')) {
        return this._galleryItemManager.delete(mod.galleryId)
        .then(() => {
          delete mod.galleryId;
          return mod;
        });
      } else {
        return Promise.resolve(mod);
      }
    }

    _addPageItem(mod) {
      if (mod.contentElement && mod.contentImport) {
        const page = {
          name: mod.name,
          element: mod.contentElement,
          import: mod.contentImport
        };
        return this._pageItemManager.create(page)
        .then((pageItem) => {
          mod.pageId = pageItem.id;
          return mod;
        });
      } else {
        return mod;
      }
    }

    _removePageItem(mod) {
      if (mod.hasOwnProperty('pageId')) {
        return this._pageItemManager.delete(mod.pageId)
        .then(() => delete mod.pageId)
        .then(() => mod);
      } else {
        return Promise.resolve(mod);
      }
    }

    _addWidgets(mod) {
      if (mod.hasOwnProperty('widgets') && Array.isArray(mod.widgets)) {
        return Promise.all((mod.widgets.map((widget) => {
          return this._widgetManager.create(widget)
          .then((widget) => widget.id);
        })))
        .then((ids) => {
          mod.widgetIds = ids;
          return mod;
        });
      } else {
        return Promise.resolve(mod);
      }
    }

    _removeWidgets(mod) {
      if (mod.hasOwnProperty('widgetIds')) {
        return Promise.all((mod.widgetIds.map((widgetId) => {
          return this._widgetManager.delete(widgetId);
        })))
        .then(() => mod);
      } else {
        return Promise.resolve(mod);
      }
    }

    _readModules() {
      return UtilFs.readdir(this._modulesDir)
      .then((modules) => {
        const moduleDirs = modules.map((mod) => {
          return path.join(this._modulesDir, mod);
        });
        return Promise.all(moduleDirs.map((moduleDir) => {
          return Promise.resolve()
          .then(() => UtilFs.stat(moduleDir))
          .then(() => this._readModuleInfo(moduleDir))
          .then((modInfo) => {
            modInfo.installedDir = moduleDir;
            if (modInfo.appDir) {
              modInfo.installedAppDir = path.join(moduleDir, modInfo.appDir);
            }
            return super.create(modInfo);
          })
          .catch((err) => {
            logger.warn('Error picking up module', err);
          });
        }));
      });
    }

    _setModuleScopes(mod) {
      if (mod.hasOwnProperty('scopes') && Array.isArray(mod.scopes)) {
        return Promise.all(mod.scopes.map((scope) => {
          return this._scopesManager.create(scope)
          .catch(() => {
            return Promise.resolve();
          });
        }))
        .then(() => {
          return Promise.resolve(mod);
        });
      } else {
        return mod;
      }
    }

    _loadModuleAppDirectory(mod) {
      if (mod.installedAppDir) {
        mod.appDirMiddleware = express.static(path.resolve(mod.installedDir, mod.installedAppDir));
        this._baseServer.use(mod.appDirMiddleware);
      }
      return Promise.resolve(mod);
    }

    _unloadModuleAppDirectory(mod) {
      if (mod.installedAppDir) {
        this._baseServer.removeMiddleware(mod.appDirMiddleware);
        delete mod.appDirMiddleware;
      }
      return Promise.resolve(mod);
    }

    _checkModuleDependenciesAreLoaded(mod) {
      if ('object' === typeof(mod.dependencies) && null !== mod.dependencies) {
        const depNames = Object.keys(mod.dependencies);
        return depNames.reduce((promise, depName) => {
          return promise
          .then(() => {
            const dep = this._getModuleFromName(depName);
            if (!dep) {
              return Promise.reject(new Error(mod.name + ' missing dependency "' + depName + '".'));
            }
            if (!dep.isLoaded) {
              return Promise.reject(new Error(mod.name + ' dependency "' + depName + '" is not loaded.'));
            }
            const depVersion = mod.dependencies[depName];
            if (dep.version && dep.version !== '') { // ignore check for dev modules with no version
              if (!this._satisfies(dep.installedVersion, depVersion)) {
                return Promise.reject(new Error(mod.name + ' dependency "' + depName + '" version does not satisfy requirement.' + dep.installedVersion));
              }
            }
          });
        }, Promise.resolve())
        .then(() => {
          return mod;
        });
      } else {
        return Promise.resolve(mod);
      }
    }

    _checkModuleDependenciesAreUnloaded(mod) {
      return Promise.resolve()
      .then(() => super.list())
      .then((modules) => modules.filter((mod) => mod.dependencies && mod.dependencies.hasOwnProperty(mod.name) && mod.isLoaded))
      .then((dependents) => {
        if (dependents.length !== 0) {
          logger.error('Other modules are still running and depending on this one. This should never happen');
          return Promise.reject(new Error('Other modules still depend on this module - this error should never happen'));
        }
        return Promise.resolve();
      });
    }

    _readInstalledBase() {
      return this._readModuleInfo(ROOT_DIR)
      .then((modInfo) => this._validateModuleFields(modInfo))
      .then((modInfo) => {
        modInfo.isLoaded = true;
        return super.create(modInfo);
      });
    }

    _readModuleInfo(dir) {
      const modInfoPath = path.resolve(dir, 'module.json');
      return UtilFs.readJSON(modInfoPath)
      .then((modInfo) => {
        modInfo.isInstalled = true;
        modInfo.isLoaded = false;
        return modInfo;
      });
    }

    _validateModuleFields(modInfo) {
      if (!modInfo) {
        return Promise.reject(new Error('Module Info must not be null'));
      }

      const name = modInfo.name;

      if ('string' !== typeof(name) || 0 >= name.length) {
        return Promise.reject(new TypeError('name must be a non-empty string'));
      }

      if (!modInfo.version) {
        logger.warn('Module %s does not have a version this will cause dependency calculation to ignore all version relating to this module.', modInfo.name);
      } else {
        if (!semver.valid(modInfo.version)) {
          return Promise.reject(new Error('Module must have a valid semver version'));
        }
      }

      return Promise.resolve(modInfo);
    }

    _generateDependencyGraph(modules) {
      let edgeCount = 0;
      const mapping = {};
      const graph = new Graph();

      graph.addNode({id: 'DNE'}, 'DNE');

      modules.forEach((mod) => {
        mapping[mod.name] = mod.id;
        graph.addNode(mod, mod.id);
      });

      modules.forEach((mod) => {
        const dependencies = mod.dependencies;
        if (dependencies) {
          Object.keys(dependencies).forEach((dependency) => {
            if (!mapping.hasOwnProperty(dependency)) {
              graph.addEdge(mod.id, 'DNE', edgeCount);
            } else {
              graph.addEdge(mod.id, mapping[dependency], edgeCount);
            }
            edgeCount += 1;
          });
        }
      });
      return graph;
    }

    _getModuleFromName(name) {
      return this._items.find((mod) => {
        return mod.name === name;
      });
    }
  }

  module.exports = ModuleManager;
})();
