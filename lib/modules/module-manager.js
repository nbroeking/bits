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
  const path = require('path');
  const Graph = require('graph-js');
  const express = require('express');

  const InfrastureMessenger = require('./module-management-messenger');

  const UtilFs = require('./../helpers/fs');

  const ROOT_DIR = path.resolve(__dirname, '../..');
  const MODULE_LOAD_TIMEOUT = 120 * 1000;

  class ModuleManager extends CrudManager {
    constructor(scopeManager, cryptoManager, userManager, loggingManager, galleryItemManager, widgetManager, pageItemManager) {
      super('base#ModuleManager', {readScopes: ['base'], writeScopes: ['base'], Messenger: require('./module-messenger')});
      this._scopesManager = scopeManager;
      this._cryptoManager = cryptoManager;
      this._userManager = userManager;
      this._loggingManager = loggingManager;
      this._galleryItemManager = galleryItemManager;
      this._widgetManager = widgetManager;
      this._pageItemManager = pageItemManager;

      this._clusterService = new ModuleClusterService(this);
      this._infrastructureMessenger = new InfrastureMessenger(this);

      this._rootDataDir = global.paths.data;
      this._modulesRootDir = path.resolve(this._rootDataDir, 'base/modules');
      this._modulesPackegesDir = path.resolve(this._modulesRootDir, 'modules-packages');
      this._modulesPackagesDecryptedDir = path.resolve(this._modulesPackegesDir, 'decrypted');
      this._modulesDir = path.resolve(this._modulesRootDir, 'modules');
      this._upgradeDir = path.resolve(global.paths.data, 'upgrades');
      this._modulesUploadDir = path.resolve(this._modulesPackegesDir, 'tmp');
    }

    load(messageCenter, baseServer) {
      this._messageCenter = messageCenter;
      this._baseServer = baseServer;
      logger.debug('Loading the module manager');
      return super.load(messageCenter, baseServer)
      .then(() => this._clusterService.load(messageCenter))
      .then(() => this._infrastructureMessenger.load(messageCenter))
      .then(() => this._initDataDir())
      .then(() => this._readInstalledBase())
      .then(() => this._readModules())
      .then(() => this.loadModules())
      .then(() => logger.debug('Modules have finished loading'));
    }

    unload(messageCenter) {
      return Promise.resolve()
      .then(() => this._infrastructureMessenger.load())
      .then(() => this._clusterService.unload());
    }

    create() {
      return Promise.reject(new Error('operation-not-supported'))
    }
    update() {
      return Promise.reject(new Error('operation-not-supported'))
    }
    delete() {
      return Promise.reject(new Error('operation-not-supported'))
    }

    getDataDirectory(module) {

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
      return super.list()
      .then((mods) => {
        const graph = this._generateDependencyGraph(mods.map((mod)=> mod));
        return this._loadModuleGrouping(graph);
      })
      .then((modules) => {
        console.log('Modules', modules);
        return modules;
      })
      .catch((err) => {
        logger.error('Error loading modules', err);
      });
    }

    unloadModules(modules) {

    }

    _loadModuleGrouping(graph) {
      const mods = {};
      return new Promise((resolve, reject) => {
        const dispatchModuleChain = () => {
          let chain = Promise.resolve();

          const modulesToLoad = this._computeModulesToLoadNext(graph).filter((mod) => mod.id !== 'DNE' && !mods.hasOwnProperty(mod.id) );

          //Base Case is if there are no more modules to load
          if( modulesToLoad.length === 0 && Object.keys(mods).length === 0) {
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
              logger.error('Error loading %s', moduleId, err);
              return super.update(moduleId, {loadError: {message: err.message}})
            })
            .catch((err) => {
              logger.error('Unable to set the error reason for the load error', err);
            });
            chain = chain.then(() => mods[moduleId]);
          });
          return chain;
        }
        dispatchModuleChain(); // Initial call
      })
      //Mark all unloaded modules as missing a dependency
      .then(() => super.list())
      .then((modules) => {
        return Promise.all(modules.map((module) => {
          if( module.isLoaded === false && !module.hasOwnProperty('loadError')) {
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
      logger.debug('Loading module %s with id %d', mod.name, mod.id)

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
            this._clusterService.removeListener('failed-load', loadError);
            this._infrastructureMessenger.removeListener('module-response', moduleResponse);
          }
          const loadError = (deadModule) => {
            if( deadModule.id === mod.id) {
              cleanUp();
              reject(new Error('Module crashed during load - unknown reason'));
            }
          }

          const moduleResponse = (responseMod, err, result) => {
            if (responseMod.id === mod.id) {
              cleanUp();
              if (err) {
                reject(err);
              } else {
                resolve(result);
              }
            }
          }

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
      .then(() => super.update(mod.id, {isLoaded: true, loadError: null}))
      .catch((err) => {
        return this._clusterService.destroyTheModule(mod)
        .then(() => Promise.reject(err));
      });
    }

    unloadModule(mod, err) {
      return this._unloadModule(mod);
    }
    _unloadModule(mod) {
      return Promise.resolve();
    }

    _initDataDir() {
      return UtilFs.mkdir(this._modulesRootDir).catch((err) => {
        if( err.code !== 'EEXIST') {
          return Promise.reject(err);
        }
      }) // Mkdir if not exists
      .then(() => UtilFs.mkdir(this._modulesPackegesDir)).catch((err) => {
        if( err.code !== 'EEXIST') {
          return Promise.reject(err);
        }
      }) // Mkdir if not exists
      .then(() => UtilFs.mkdir(this._modulesPackagesDecryptedDir)).catch((err) => {
        if( err.code !== 'EEXIST') {
          return Promise.reject(err);
        }
      }) // Mkdir if not exists
      .then(() => UtilFs.mkdir(this._modulesDir)).catch((err) => {
        if( err.code !== 'EEXIST') {
          return Promise.reject(err);
        }
      }) // Mkdir if not exists
      .then(() => UtilFs.mkdir(this._modulesUploadDir)).catch((err) => {
        if( err.code !== 'EEXIST') {
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
        .then(() => mod);
      } else {
        return mod;
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
        .then(() => mod);
      } else {
        return mod;
      }
    }

    _addWidgets(mod) {
      if( !mod.hasOwnProperty(widget) || Array.isArray(mod.widget))
      return mod.widgets.reduce((chain, widget) => {
        return chain.then(() => {
          return this._widgetManager.create(widget);
        })
        .then((w) => {
          widget.id = w.id;
        })
        .catch(() => null);
      }, Promise.resolve())
      .then(() => mod);
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
            if( modInfo.appDir) {
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
      console.log('Mod', mod);
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

    _checkModuleDependenciesAreLoaded(mod) {
      if ('object' === typeof(mod.dependencies) && null !== mod.dependencies) {
        const depNames = Object.keys(mod.dependencies);
        return depNames.reduce((promise, depName) => {
          return promise
          .then(() => {
            console.log('Looking for depNames', depName)
            const dep = this._getModuleFromName(depName);
            console.log('Dep', dep);
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

    _readInstalledBase() {
      return this._readModuleInfo(ROOT_DIR)
      .then((modInfo) => this._validateModuleFields(modInfo))
      .then((modInfo) => {
        modInfo.isLoaded = true;
        return super.create(modInfo)
      });
    }

    _readModuleInfo(dir) {
      const modInfoPath = path.resolve(dir, 'module.json');
      return UtilFs.readJSON(modInfoPath)
      .then((modInfo) => {
        modInfo.isInstalled = true;
        modInfo.isLoaded = false;
        return modInfo;
      })
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

      modules.forEach((mod)=> {
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
