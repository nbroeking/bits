/**
Copyright 2017 LGS Innovations

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

  const UPGRADE_BASE_CHECK_TIME = (new Date('2017-01-01')).getTime();

  const path = require('path');
  const cluster = require('cluster');
  const EventEmitter = require('events');
  const semver = require('semver');
  const express = require('express');
  const LoggerFactory = require('../logging/logger-factory');
  const UtilFs = require('../helpers/fs');
  const UtilChildProcess = require('../helpers/child-process');
  const Algorithms = require('../utils/algorithms');
  const ModuleRouter = require('./modules-router');
  const ModuleMessenger = require('./module-messenger');

  const Digraph = Algorithms.Digraph;
  const Topological = Algorithms.Topological;
  const BreadthFirstDirectedPaths = Algorithms.BreadthFirstDirectedPaths;
  const logger = LoggerFactory.getLogger();

  const BaseActivityApi = require('../activity/activity-api');

  const ALLOW_NON_ENCRYPTED_MODULE_PACKAGES = false;

  const ROOT_DIR = path.resolve(__dirname, '../..');
  const MODULE_LOAD_TIMEOUT = 120 * 1000;

  class ModuleManager extends EventEmitter {
    constructor(scopesManager, cryptoManager, userManager, loggingManager) {
      super();
      this._scopesManager = scopesManager;
      this._cryptoManager = cryptoManager;
      this._userManager = userManager;
      this._loggingManager = loggingManager;

      this._modules = [];

      this._rootDataDir = global.paths.data;
      this._modulesRootDir = path.resolve(this._rootDataDir, 'base/modules');
      this._modulesPackegesDir = path.resolve(this._modulesRootDir, 'modules-packages');
      this._modulesPackagesDecryptedDir = path.resolve(this._modulesPackegesDir, 'decrypted');
      this._modulesDir = path.resolve(this._modulesRootDir, 'modules');
      this._upgradeDir = path.resolve(global.paths.data, 'upgrades');

      this._modulesUploadDir = path.resolve(this._modulesPackegesDir, 'tmp');

      this._messageCenter = null;
      this._baseServer = null;
      this._baseActivityApi = null;

      this._router = new ModuleRouter(this, this._modulesPackegesDir, this._modulesUploadDir);
      this._messenger = new ModuleMessenger(this);
      // const LINUX_SCRIPT_DIR = path.resolve(ROOT_DIR, 'Linux/bits-files/bits-base/scripts');
      this._upgradeBaseCommand = path.resolve('/tmp', 'upgrade-base');

      this._managerState = 'Idle';
      this._moduleStatus = 'Idle';
      this._currentModule = 'None';
    }

    // Only called by the master
    load(messageCenter, baseServer) {
      this._messageCenter = messageCenter;
      this._baseServer = baseServer;
      this._baseActivityApi = new BaseActivityApi(messageCenter);
      cluster.on('exit', this._onDeath.bind(this));

      return Promise.resolve()
      .then(() => this._loggingManager.addLogDirectory({dirpath: this._upgradeDir}))
      .then(() => this._initDataDir())
      .then(() => this.setManagerState('Loading'))
      .then(() => this._messenger.load(this._messageCenter))
      .then(() => this._readModulePackages())
      .then(() => this._readInstalledBase())
      .then(() => this._readInstalledModules())
      .then(() => this._loadInstalledModules())
      .then(() => this._addModuleManagerEndpoint())
      .then(() => this.setManagerState('Idle'))
      .then(() => logger.debug('Modules have finished loading'));
    }

    getModuleStatus() {
      return Promise.resolve(this._moduleStatus);
    }
    getCurrentModule() {
      return Promise.resolve(this._currentModule);
    }
    getManagerState() {
      return Promise.resolve(this._managerState);
    }

    setModuleStatus(status) {
      this._moduleStatus = status;
      this.emit('module-status-changed', status);
    }

    setCurrentModule(mod) {
      if (!mod) {
        this._currentModule = 'None';
      } else {
        if (mod.displayName) {
          this._currentModule = mod.displayName;
        } else {
          this._currentModule = mod.name;
        }
      }
      this.emit('current-module-changed', this._currentModule);
    }

    setManagerState(state) {
      this._managerState = state;
      this.emit('manager-state-changed', state);
    }

    filterModule(module) {
      if (!module) {
        return {};
      }
      return {
        name: module.name,
        version: module.installedVersion,
        dependencies: module.dependencies,
        displayName: module.installedDisplayName,
        icon: module.installedIcon,
        category: module.installedCategory,
        contentImport: module.installedContentImport,
        contentElement: module.installedContentElement,
        isBase: module.isBase,
        isVisible: module.isVisible,
        isInstalled: module.isInstalled,
        isLoaded: module.isLoaded,
        loadError: module.loadError,
        installedVersion: module.installedVersion,
        packageVersions: Object.keys(module.packageVersions)
      };
    }

    _getModuleList() {
      return this._modules.map((module) => this.filterModule(module));
    }


    _requestList() {
      return Promise.resolve(this._getModuleList());
    }

    // Should only be called from child process
    dispatchModule(mod, messageCenter) {
      this._messageCenter = messageCenter;
      this.boundDie = this.die.bind(this);

      process.on('SIGTERM', () => {
        setTimeout(() => {
          logger.debug('We have been asked to exit so now were dying');
          process.exit(0);
        });
      });
      return this._loadModuleIndexJs(mod)
      // Call load on module's index.js
      .then(() => this._callModuleIndexJsLoad(mod, messageCenter))
      .then(() => this._messageCenter.addRequestListener(`base-module-die-${mod.name}`, null, this.boundDie))
      .then((result) => {
        this._dispatchedMod = mod;
        messageCenter.sendEvent('base-module-finished-load', null, null, result);
        return result;
      })
      .catch((err) => {
        let error = err.error || err;
        if (err instanceof Error) {
          error = {
            name: err.name,
            message: err.message
          };
        }
        messageCenter.sendEvent('base-module-finished-load', null, error, null);
        return Promise.reject(err);
      });
    }

    die() {
      const mod = this._dispatchedMod;
      return this._messageCenter.removeRequestListener(`base-module-die-${mod.name}`, this.boundDie)
      .then(() => this.moduleUnload(this._dispatchedMod));
    }

    moduleUnload(mod) {
      return this._callModuleIndexJsUnload(mod)
      .catch((err) => {
        logger.error('Error unloading module index js', err);
        return Promise.reject(err); // We dont really care if this fails because the whole process going to die
      });
    }

    _readModulePackages() {
      // Get all 'tgz' files in the module packages directory
      return UtilFs.readdir(this._modulesPackegesDir)
      .then((filenames) => {
        return this._filterFilenames(/\.tgz$/i, filenames);
      })
      // Unpack the module.json from the tgz
      .then((filenames) => {
        logger.debug('Module Package filenames', {
          filenames: filenames
        });
        return this._extractModulePackagesInfo(filenames);
      });
    }

    _filterFilenames(filter, filenames) {
      return filenames.filter((filename) => {
        return filter.test(filename);
      });
    }

    _extractModulePackagesInfo(filenames) {
      return Promise.all(filenames.map((filename) => {
        return this.extractModulePackageInfo(filename)
        .catch(() => {
          // Clean up unused module package
          return UtilFs.unlink(path.resolve(this._modulesPackegesDir, filename));
        });
      }));
    }

    extractModulePackageInfo(filename) {
      // Extract module.json file
      return this._extractModuleJsonFile(filename)
      // Mark this module info with package file information
      .then((modInfo) => {
        modInfo.packageFilePath = path.resolve(this._modulesPackegesDir, filename);
        modInfo.isPackage = true;

        // Add module info to list of modules
        return this.addModuleInfo(modInfo);
      });
    }

    _extractModuleJsonFile(filename) {
      const archiveFile = path.resolve(this._modulesPackegesDir, filename);
      return this.getModuleInfoFromModulePackage(archiveFile);
    }

    getModuleInfoFromModulePackage(filepath) {
      const command = 'tar';

      const args = [
        '-x', '-O',
        '-f', filepath,
        'module.json',
      ];

      return UtilChildProcess.createSpawnPromise(command, args)
      .then((results) => {
        if (0 === results.code) {
          const stdout = results.stdout;
          const rawInfo = stdout.reduce((rawInfo, line) => rawInfo + line, '');
          return JSON.parse(rawInfo);
        } else {
          return Promise.reject(new Error('Failed to extract module info'));
        }
      });
    }

    addModuleInfo(modInfo) {
      return Promise.resolve(modInfo)
      .then(this._checkModuleInfoEngines.bind(this))
      // Check that all required parameters are there
      .then(this.checkModuleInfoRequiredParameters.bind(this))
      // Add the info to the list
      .then(this._addModuleInfoToModuleList.bind(this))
      .then((result) => {
        return result;
      });
    }

    _checkModuleInfoEngines(modInfo) {
      // An engine is a framework on which a module is run. Using node js as an example, the base
      // runs on the node js engine. As such a minimum version of node js can be specified to ensure
      // the expected api is present. For any modules that are expected to run on the base framework
      // it is reasonable to assume the module requires the base to be present (a given cause the
      // base is loading the module). This method is used to check that the module does not require
      // a higher version of the base. Since this was added in base version 0.8.0, a module that does
      // specify a require base engine version will be assumed run on any version of the base (which
      // was assumed prior to this patch).

      return modInfo;
    }

    _initDataDir() {
      return UtilFs.mkdir(this._modulesRootDir).catch((err) => {}) // Mkdir if not exists
      .then(() => UtilFs.mkdir(this._modulesPackegesDir)).catch((err) => {}) // Mkdir if not exists
      .then(() => UtilFs.mkdir(this._modulesPackagesDecryptedDir)).catch((err) => {}) // Mkdir if not exists
      .then(() => UtilFs.mkdir(this._modulesDir)).catch((err) => {}) // Mkdir if not exists
      .then(() => UtilFs.mkdir(this._modulesUploadDir)).catch((err) => {}); // Mkdir if not exists
    }

    checkModuleInfoRequiredParameters(modInfo) {
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

    _addModuleInfoToModuleList(modInfo) {
      let mod = this._getModuleFromName(modInfo.name);
      if (!mod) {
        mod = this._createModuleFromModuleInfo(modInfo);
        this._modules.push(mod);
      }

      // check to see if this package version already exists
      if (modInfo.isPackage && !mod.packageVersions[modInfo.version]) {
        // Add package file to the modules package verions
        mod.packageVersions[modInfo.version] = modInfo.packageFilePath;
      } else if (modInfo.isPackage) {
        logger.warn('Module %s has multiple packages with same verion, ignoring %s', modInfo.name, modInfo.packageFilePath);
        return Promise.reject(new Error('module already has module package with version ' + modInfo.version));
      }

      if (modInfo.isInstalled && !mod.isInstalled) {
        mod.isInstalled = true;
        mod.installedVersion = modInfo.version;
        mod.installedDir = modInfo.installedDir;
        mod.dependencies = modInfo.dependencies || {};
        mod.installedScriptDir = modInfo.scriptDir;
        mod.installedAppDir = modInfo.appDir;
        mod.installedContentImport = modInfo.contentImport;
        mod.installedContentElement = modInfo.contentElement;
        mod.installedIcon = modInfo.icon;
        mod.installedCategory = modInfo.category;
        mod.installedDisplayName = modInfo.displayName;
        mod.installedAllowedGroups = modInfo.allowedGroups || [];
        mod.installedGroups = modInfo.groups || [];
        mod.installedGitShortHash = modInfo.git_short_hash || 'N/A';
        mod.widgets = Array.isArray(modInfo.widgets) ? modInfo.widgets : [];

        if (!mod.installedContentElement && mod.installedContentImport) {
          // Try to parse the contentImport and use its file name as the content element
          mod.installedContentElement = path.basename(mod.installedContentImport, '.html');
        }

        mod.widgets.forEach((widget) => {
          if (!widget.element && widget.import) {
            widget.element = path.basename(widget.import, '.html');
          }
        });

        if (modInfo['upgrade-dependencies']) {
          mod['upgrade-dependencies'] = modInfo['upgrade-dependencies'];
        }
      } else if (modInfo.isInstalled) {
        logger.warn('Module ' + mod.name + ' has multiple installations, ignoring ' + modInfo.installedDir);
      }

      return Promise.resolve(modInfo);
    }

    _createModuleFromModuleInfo(modInfo) {
      let mod = {};
      mod.name = modInfo.name;
      mod.isInstalled = false;
      mod.isLoaded = false;
      mod.loadError = null;
      mod.packageVersions = {};
      mod.isBase = modInfo.isBase || false;
      mod.isSetting = modInfo.isSetting || false;
      mod.isVisible = modInfo.isVisible || false;
      mod.scopes = modInfo.scopes || [];
      return mod;
    }

    _readInstalledBase() {
      return this._extractInstalledModuleInfo(ROOT_DIR);
    }

    _readInstalledModules() {
      // Read all files in the modules directory
      return UtilFs.readdir(this._modulesDir)
      // Get list of directories in modules directory
      .then(this._filterDirectories.bind(this))
      // Unpack the module.json from the tgz
      .then(this._extractInstalledModulesInfo.bind(this));
    }

    _filterDirectories(files) {
      let filePaths = files.map((file) => {
        return path.resolve(this._modulesDir, file);
      });
      return Promise.all(filePaths.map((mod) => {
        return UtilFs.stat(mod)
        .catch((err) => {
          if (err.code === 'ENOENT') {
            return Promise.resolve({
              code: 'ENOENT'
            });
          } else {
            return Promise.reject(err);
          }
        });
      }))
      .then((stats) => stats.filter((stat) => {
        if (stat.code === 'ENOENT') {
          return false;
        } else {
          return true;
        }
      }))
      .then((stats) => {
        const dirs = [];

        for (let i = 0; i < filePaths.length && i < stats.length; i++) {
          if (stats[i] && stats[i].isDirectory()) {
            dirs.push(filePaths[i]);
          }
        }
        return Promise.resolve(dirs);
      });
    }

    _extractInstalledModulesInfo(dirs) {
      return Promise.all(dirs.map(this._extractInstalledModuleInfo.bind(this)));
    }

    _extractInstalledModuleInfo(dir) {
      let modInfoPath = path.resolve(dir, 'module.json');
      return UtilFs.readJSON(modInfoPath)
      .then((modInfo) => {
        modInfo.installedDir = dir;
        modInfo.isInstalled = true;
        return this.addModuleInfo(modInfo);
      })
      .catch((err) => {
        if (-2 === err.errno && err.code) {
          logger.debug('Ignoring directory that does not contain module.json', {
            directory: dir
          });
        } else {
          logger.warn('Failed to read module.json: %s', err.toString(), {
            directory: dir
          });
        }
      });
    }

    _loadInstalledModules() {
      return this._getInstalledModules()
      .then((installedModules) => this.loadModules(installedModules, {
        ignoreFailures: true
      }));
    }

    _getInstalledModules() {
      return this.getModuleList()
      .then((modules) => modules.filter((mod) => mod.isInstalled));
    }

    loadModulesByName(names) {
      return this._getModulesFromName(names)
      .then((modules) => this.loadModules(modules));
    }

    loadModules(mods, {
      ignoreFailures = false
    } = {}) {
      return Promise.resolve()
      .then(() => this.setManagerState('Loading'))
      .then(() => this._determineLoadOrder(mods))
      .then((orderedModules) => {
        return orderedModules.reduce((promise, orderedModule) => {
          return promise
          .then(() => this.loadModule(orderedModule))
          .catch((err) => {
            logger.warn('Failed to load module: %s - %s', orderedModule.name, err.message);
            if (!ignoreFailures) {
              return Promise.reject(err);
            }
          });
        }, Promise.resolve());
      })
      .then(() => this.setManagerState('Idle'))
      .catch((err) => {
        this.setManagerState('Idle');
        return Promise.reject(err);
      });
    }

    _determineLoadOrder(mods) {
      return this._buildDependentGraphFromModules(mods)
      .then((g) => {
        const t = new Topological(g);
        if (t.hasOrder()) {
          const order = t.order().map((i) => mods[i]);
          return order;
        } else {
          return Promise.reject(new Error('Cannot determine load order'));
        }
      });
    }

    installModule(mod, version) {
      // Check the version exists in the package versions
      if (!mod.packageVersions || !mod.packageVersions[version]) {
        return Promise.reject(new Error('No version ' + version + ' for module.'));
      }

      // Check if the module is already installed
      if (mod.isInstalled) {
        if (mod.installedVersion === version) {
          return Promise.reject(new Error('Module is already installed with the same version.'));
        } else if (mod.isBase) {
          // Check if the module is a base (of course it's installed, but we want to upgrade it
          return Promise.resolve()
          .then(() => this._verifyMinimumBase(mod))
          .then(() => this.upgradeBase(mod.packageVersions[version]))
          .catch((err) => {
            logger.error('There was an error running a base upgrade', err);
            return this._baseActivityApi.create({
              title: `Unable to run base upgrade ${err.toString()}`,
              projectName: 'Base Upgrade',
              icon: 'icons:error',
            })
            .then((err) => Promise.reject(err));
          });
        } else {
          return Promise.resolve('Module is already installed');
        }
      }

      // This is the filename for the module package to install
      let filename = mod.packageVersions[version];
      let installedDir = path.resolve(this._modulesDir, mod.name);

      return Promise.resolve()
      .then(() => UtilFs.rmdir(installedDir, {
        recursive: true
      }))
      .catch((err) => {
        if ('ENOENT' !== err.code) {
          throw err;
        }
      })
      .then(() => UtilFs.mkdir(installedDir))
      .then(() => this._extractModulePackageIntoDirectory(filename, installedDir))
      .then(() => this._extractNodeModules(installedDir))
      .then(() => this._extractInstalledModuleInfo(installedDir))
      .then((result) => {
        logger.debug('Installed module', {
          name: mod.name,
          version: version
        });
        this.emit('module list change', this._modules);
        this._messenger.reportModules(this._getModuleList());
        return result;
      });
    }

    _verifyMinimumBase(mod) {
      // Should only get called for base so we can check the base required version
      if (mod && mod['upgrade-dependencies'] && mod['upgrade-dependencies']['bits-base']) {
        return this.getModuleFromName(mod.name)
        .then((base) => {
          const versionString = mod['upgrade-dependencies']['bits-base'];
          const baseVersion = base.installedVersion;

          const satisfies = this._satisfies(baseVersion, versionString);
          if (satisfies) {
            return Promise.resolve();
          } else {
            return Promise.reject(new Error('Base does not meet the minimum required version for this upgrade'));
          }
        });
      } else {
        // Try and load the sucker
        return Promise.resolve();
      }
    }

    _satisfies(version, versionCheck) {
      // strip off the '-.*' (any pre release info) if it exists because semver does not currently handle it
      return semver.satisfies(version.split('-')[0], versionCheck);
    }

    _extractModulePackageIntoDirectory(archiveFile, installDir) {
      const command = 'tar';

      const args = [
        '--warning=none',
        '-x',
        '-f', archiveFile,
        '-C', installDir,
      ];

      return UtilChildProcess.spawn(command, args)
      .then((results) => {
        if (0 === results.code) {
          return path.resolve(installDir, 'module.json');
        } else {
          return Promise.reject(new Error('Failed to extract module package'));
        }
      });
    }

    _extractNodeModules(installDir) {
      return Promise.resolve()
      .then(() => {
        const cmd = 'npm';
        const args = [
          'run',
          'bits:install'
        ];
        const options = {
          cwd: installDir,
          env: Object.assign(process.env, {
            DATA_DIR: this._rootDataDir,
            YARN_CACHE_FOLDER: path.resolve(installDir, './support/yarn-cache')
          })
        };
        return UtilChildProcess.spawn(cmd, args, options);
      })
      .then((result) => {
        if (0 !== result.code) {
          const stderr = result.stderr.reduce((stderr, line) => stderr + line, '');
          logger.warn('Failed to install module\'s node packages.', {
            stderr: stderr,
            code: result.code
          });
        }
      });
    }

    loadModule(module) {
      const mod = this._getModuleFromName(module.name);

      if (mod.isBase) {
        return Promise.resolve(mod);
      }

      if (mod.isLoaded) {
        logger.warn('Module %s is already loaded', mod.name, {
          name: mod.name
        });
        return Promise.resolve(mod);
      }

      if (!mod.isInstalled) {
        return Promise.reject(new Error('Cannot load a module that is not installed'));
      }

      const start = process.hrtime();
      return Promise.resolve()
      .then(() => this.setModuleStatus('Loading'))
      .then(() => this.setCurrentModule(mod))
      .then(() => this._checkModuleDependenciesAreLoaded(mod))
      .then(() => this._loadModuleAppDirectory(mod))
      .then(() => this._setModuleScopes(mod))
      .then(() => {
        return new Promise((resolve, reject) => {
          // Potential timeout code for module loading
          const loadCallFinished = (err, result) => {
            clearTimeout(timeout);
            this._messageCenter.removeEventListener('base-module-finished-load', loadCallFinished);
            if (err) {
              reject(err);
            } else {
              resolve(result);
            }
          };

          const timeout = setTimeout(() => {
            this._messageCenter.removeEventListener('base-module-finished-load', loadCallFinished);
            logger.warn('Module load timeout occured for mod %s', mod.name);
            reject('Error: ' + mod.name + ' took too long to load');
          }, MODULE_LOAD_TIMEOUT);

          this._messageCenter.addEventListener('base-module-finished-load', null, loadCallFinished);

          // Spawn the child
          let env = {};
          env.mod = JSON.stringify(mod);
          let childProcess = cluster.fork(env);
          this._registerChildProcessHandlers(childProcess, mod);
        });
      })
      .then(() => this._markModuleLoaded(mod))
      .then((mod) => {
        const diff = process.hrtime(start);
        const duration = Math.floor((diff[0] * 1e9 + diff[1]) / 1e6);
        logger.debug('Loaded module %s', mod.name, {
          name: mod.name,
          version: mod.installedVersion,
          duration: duration
        });

        this.emit('module list change', this._modules);
        this._messenger.reportModules(this._getModuleList());
        if (mod.installedContentElement && mod.installedContentImport) {
          const page = {
            name: mod.name,
            element: mod.installedContentElement,
            import: mod.installedContentImport
          };
          return this._messageCenter.sendRequest('base#PageItems create', null, page)
          .then((page) => {
            mod.pageId = page.id;
            return mod;
          })
          .catch(() => mod);
        } else {
          return mod;
        }
      })
      .then((mod) => {
        if (mod.installedIcon && mod.installedDisplayName) {
          const galleryItem = {
            title: mod.installedDisplayName,
            icon: mod.installedIcon,
            category: mod.installedCategory,
            href: `/${mod.name}`,
            scopes: mod.scopes.map((scope) => scope.name)
          };
          return this._messageCenter.sendRequest('base#GalleryItems create', null, galleryItem)
          .then((galleryItem) => {
            mod.galleryId = galleryItem.id;
            return mod;
          })
          .catch(() => mod);
        } else {
          return mod;
        }
      })
      .then((mod) => {
        return mod.widgets.reduce((chain, widget) => {
          return chain.then(() => {
            return this._messageCenter.sendRequest('base#Widgets create', null, widget);
          })
          .then((w) => {
            widget.id = w.id;
          })
          .catch(() => null);
        }, Promise.resolve())
        .then(() => mod);
      })
      .then((mod) => {
        return Promise.resolve()
        .then(() => this.setModuleStatus('Idle'))
        .then(() => this.setCurrentModule(null))
        .then(() => mod);
      })
      .catch((err) => {
        logger.warn('Failed to load module %s', mod.name);
        mod.loadError = err;
        Promise.resolve()
        .then(() => this.setModuleStatus('Idle'))
        .then(() => this.setCurrentModule(null));
        return this._unregisterChildProcessHandlers(mod)
        .then(() => Promise.reject(err));
      });
    }

    unloadModule(module) {
      const mod = this._getModuleFromName(module.name);
      mod.loadError = null;
      if (!mod.isLoaded) {
        return Promise.resolve(mod);
      }

      const start = process.hrtime();

      this.setModuleStatus('Unloading');
      this.setCurrentModule(mod);
      return Promise.resolve(mod)

      // Check Module dependents are unloaded
      .then(this._checkModuleDependentsAreUnloaded.bind(this))
      // Call unload on the module's index.js
      .then(() => this._cleanUpBeforeUnload(mod))
      .then(() => {
        if (mod.process) {
          return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              logger.warn('Module unload timeout occured for mod %s', mod.name);
              reject('Error: %s took too long to unload', mod.name);
            }, MODULE_LOAD_TIMEOUT);

            return this._messageCenter.sendRequest(`base-module-die-${mod.name}`, null)
            .then((result) => {
              clearTimeout(timeout);
              resolve(result);
            })
            .catch((err) => {
              clearTimeout(timeout);
              reject(err);
            });
          });
        } else {
          logger.warn('Unloading a module that does not have a process. This can happen if your module crashed but under normal operating conditions you should not see this');
          return Promise.resolve(mod);
        }
      })
      .catch((err) => {
        if (err && err.reason === 'dependents') {
          return Promise.reject(new Error(err.message));
        }
        logger.error('Module did not die cleanly... Forcing a death to recover', err);
        return Promise.resolve();
      })
      .then(() => this._unregisterChildProcessHandlers(mod))
      // Remove app elements dir
      .then(() => this._unloadModuleAppDirectory(mod))
      // Mark module as unloaded
      .then(() => this._cleanUpModuleScopes(mod))
      .then(() => this._markModuleUnloaded(mod))
      .then((mod) => {
        const diff = process.hrtime(start);
        const duration = Math.floor((diff[0] * 1e9 + diff[1]) / 1e6);

        logger.debug('Unloaded module %s', mod.name, {
          name: mod.name,
          duration: duration
        });

        this.emit('module list change', this._modules);
        this._messenger.reportModules(this._getModuleList());

        if (mod.pageId) {
          return this._messageCenter.sendRequest('base#PageItems delete', null, mod.pageId)
          .then(() => {
            mod.pageId = null;
            return mod;
          })
          .catch(() => mod);
        } else {
          return mod;
        }
      })
      .then((mod) => {
        if (mod.galleryId) {
          return this._messageCenter.sendRequest('base#GalleryItems delete', null, mod.galleryId)
          .then(() => {
            mod.galleryId = null;
            return mod;
          })
          .catch(() => mod);
        } else {
          return mod;
        }
      })
      .then((mod) => {
        return Promise.resolve()
        .then(() => this.setModuleStatus('Idle'))
        .then(() => this.setCurrentModule(null))
        .then(() => mod);
      })
      .catch((err) => {
        Promise.resolve()
        .then(() => this.setModuleStatus('Idle'))
        .then(() => this.setCurrentModule(null));
        return this._baseActivityApi.create({
          title: `Unable to unload module ${err.message}`,
          projectName: 'Base Modules',
          icon: 'icons:error',
        })
        .then((err) => Promise.reject(err));
      });
    }

    _onDeath(pid) {
      logger.error('Client with pid %s died a horrible death', pid.process.pid);
    }

    _exitHandler(mod, pid) {
      logger.error('Module %s died cleaning up now', mod.name);

      return this._unregisterChildProcessHandlers(mod)
      .then(() => {
        return this.unloadModule(mod)
        .catch((err) => {
          logger.error('Unable to unload the module that crashed. This is probably due to dependencies on the crashed module preventing a clean up.');
          return this._baseActivityApi.create({
            title: `Module ${mod.name} has crashed with an improper clean up. All modules will need to be reloaded.`,
            projectName: 'Base Modules',
            icon: 'icons:error',
          })
          .then(() => {
            return Promise.reject(err);
          });
        });
      })
      .then(() => {
        return this._baseActivityApi.create({
          title: `Module ${mod.name} has crashed.`,
          projectName: 'Base Modules',
          icon: 'icons:error',
        });
      })
      .catch((err) => {
        logger.error('Unable to clean up after a crashed child %s', mod.name, err);
      });
    }

    _registerChildProcessHandlers(childProcess, mod) {
      mod.process = childProcess;
      mod.exitHandler = this._exitHandler.bind(this, mod);
      mod.process.on('exit', mod.exitHandler);
      return Promise.resolve();
    }

    _cleanUpBeforeUnload(mod) {
      if (mod.process) {
        if (mod.exitHandler) {
          mod.process.removeListener('exit', mod.exitHandler);
          delete mod.exitHandler;
        }
      }
      return Promise.resolve();
    }

    _unregisterChildProcessHandlers(mod) {
      return Promise.resolve()
      .then(() => {
        if (mod.process) {
          if (mod.exitHandler) {
            mod.process.removeListener('exit', mod.exitHandler);
            mod.exitHandler = null;
          }
          mod.process.kill();
          this._messageCenter.cleanUpWorker(mod.process);
          this.emit('died', mod.process.id);
          mod.process = null;
        }
      });
    }

    _setModuleScopes(mod) {
      return Promise.all(mod.scopes.map((scope) => {
        return this._scopesManager.create(scope)
        .catch(() => {
          return Promise.resolve();
        });
      }))
      .then(() => {
        return Promise.resolve(mod);
      });
    }

    _cleanUpModuleScopes(mod) {
      return Promise.all(mod.scopes.map((scope) => {
        // TODO return this._scopesManager.remove(scope);
        // NOT implemented yet
        return Promise.resolve(mod);
      }))
      .then(() => {
        return Promise.resolve(mod);
      });
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

            if (!dep.isLoaded && !dep.isBase) {
              return Promise.reject(new Error(mod.name + ' dependency "' + depName + '" is not loaded.'));
            }

            const depVersion = mod.dependencies[depName];

            if (dep.installedVersion) { // ignore check for dev modules with no version
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

    _loadModuleScriptDirectory(mod) {
      return Promise.resolve(mod);
    }

    _loadModuleAppDirectory(mod) {
      if (mod.installedAppDir) {
        mod.appDirMiddleware = express.static(path.resolve(mod.installedDir, mod.installedAppDir));
        this._baseServer.use(mod.appDirMiddleware);
      }
      return Promise.resolve(mod);
    }

    _addModuleGroups(mod) {
      let groups = mod.installedGroups;
      if (!groups) {
        return Promise.resolve(mod);
      }

      return Promise.all(groups.map((group) => {
        return this._userManager.addGroup(group)
        .then(null, () => {
          return Promise.resolve();
        });
      }))
      .then(() => {
        return Promise.resolve(mod);
      });
    }

    _loadModuleIndexJs(mod) {
      if ('string' !== typeof(mod.installedDir)) {
        return Promise.reject(new TypeError('Module install directory must be a string'));
      }

      const indexJsPath = path.resolve(mod.installedDir, 'index.js');

      return UtilFs.stat(indexJsPath)
      .then((stat) => stat.isFile(), () => false)
      .then((isFile) => {
        if (isFile) {
          const re = new RegExp(mod.installedDir);

          Object.keys(require.cache)
          .filter((path) => re.test(path))
          .forEach((path) => {
            require.cache[path] = null;
          });

          mod.indexJs = require(indexJsPath);
        }
      })
      .then(() => mod);
    }

    _callModuleIndexJsLoad(mod, messageCenter) {
      if (mod.indexJs) {
        if ('function' === typeof(mod.indexJs.load)) {
          return Promise.resolve()
          .then(() => mod.indexJs.load(messageCenter))
          .then(() => mod);
        } else {
          return Promise.reject(new Error('index js does not define load'));
        }
      } else {
        return Promise.resolve(mod);
      }
    }

    _markModuleLoaded(mod) {
      mod.isLoaded = true;
      return Promise.resolve(mod);
    }

    _checkModuleDependentsAreUnloaded(mod) {
      return this.getModuleDependentList(mod.name)
      .then((dependents) => {
        const loadedDependent = dependents.find((dependent) => dependent.isLoaded);
        if (loadedDependent) {
          return Promise.reject({
            reason: 'dependents',
            message: loadedDependent.name + ' is dependent on ' + mod.name + '.'
          });
        } else {
          return mod;
        }
      });
    }

    _callModuleIndexJsUnload(mod) {
      if (mod.indexJs) {
        if ('function' === typeof(mod.indexJs.unload)) {
          return Promise.resolve()
          .then(() => {
            return mod.indexJs.unload(this._messageCenter);
          })
          .then(() => {
            return mod;
          });
        } else {
          return Promise.resolve(mod);
        }
      } else {
        return Promise.resolve(mod);
      }
    }

    _unloadModuleAppDirectory(mod) {
      if (mod.installedAppDir) {
        this._baseServer.removeMiddleware(mod.appDirMiddleware);
        mod.appDirMiddleware = null;
      }
      return Promise.resolve(mod);
    }

    _markModuleUnloaded(mod) {
      mod.isLoaded = false;
      return Promise.resolve(mod);
    }

    Module(mod) {
      if (!mod.isInstalled || mod.isBase) {
        return Promise.resolve(mod);
      }

      return this.unloadModule(mod)
      .then(() => UtilFs.lstat(mod.installedDir))
      .then((lstats) => {
        if (lstats.isDirectory()) {
          return UtilFs.rmdir(mod.installedDir, {
            recursive: true
          });
        } else {
          return UtilFs.unlink(mod.installedDir);
        }
      })
      .then(() => this._markModuleUninstalled(mod))
      .then((result) => {
        if (!this._shouldKeepModule(mod)) {
          this._removeModuleFromModuleList(mod);
        }

        logger.debug('Uninstalled module', {
          name: mod.name
        });

        this.emit('module list change', this._modules);
        this._messenger.reportModules(this._getModuleList());

        return result;
      });
    }

    _markModuleUninstalled(mod) {
      delete mod.installedVersion;
      delete mod.installedDir;
      delete mod.dependencies;
      delete mod.installedScriptDir;
      delete mod.installedAppDir;
      delete mod.installedContentImport;
      delete mod.installedContentElement;
      delete mod.installedIcon;
      delete mod.installedCategory;
      delete mod.installedDisplayName;
      delete mod.installedAllowedGroups;
      delete mod.installedGroups;
      delete mod.installedGitShortHash;
      delete mod.widgets;
      mod.isInstalled = false;
      return Promise.resolve(mod);
    }

    uninstallModulesByName(names) {
      return this._getModulesFromName(names)
      .then((modules) => this._uninstallModules(modules));
    }

    uninstallModule(mod) {
      let self = this;

      if (!mod.isInstalled || mod.isBase) {
        return Promise.resolve(mod);
      }

      return this.unloadModule(mod)
      .then(() => UtilFs.lstat(mod.installedDir))
      .then((lstats) => {
        if (lstats.isDirectory()) {
          return UtilFs.rmdir(mod.installedDir, {
            recursive: true
          });
        } else {
          return UtilFs.unlink(mod.installedDir);
        }
      })
      .then(() => this._markModuleUninstalled(mod))
      .then((result) => {
        if (!self._shouldKeepModule(mod)) {
          self._removeModuleFromModuleList(mod);
        }

        logger.debug('Uninstalled module', {
          name: mod.name
        });

        this._messenger.reportModules(this._getModuleList());
        return result;
      })
      .catch((err) => {
        logger.error('Unable to uninstall module', err);
        return Promise.reject(err);
      });
    }

    _uninstallModules(modules, options) {
      options = options || {};

      const ignoreFailures = options.ignoreFailures || false;

      return Promise.resolve()
      .then(() => this.setManagerState('Uninstalling'))
      .then(() => this._determineUninstallOrder(modules))
      .then((modules) => {
        return modules.reduce((promise, mod) => {
          return promise
          .then(() => this.uninstallModule(mod))
          .catch((err) => {
            logger.warn('Failed to uninstall module: %s', err.message, {
              name: mod.name,
              error: {
                name: err.name,
                message: err.message,
              },
            });
            logger.warn(err.stack);

            if (!ignoreFailures) {
              return Promise.reject(err);
            }
          });
        }, Promise.resolve());
      })
      .then(() => this.setManagerState('Idle'))
      .catch((err) => {
        this.setManagerState('Idle');
        return Promise.reject(err);
      });
    }

    remove(name, version) {
      let mod = this._getModuleFromName(name);
      if (!mod) {
        return Promise.reject(new Error('No module with name ' + name));
      }

      // Check the version exists in the package versions
      let filepath = mod.packageVersions[version];
      if ('string' !== typeof(filepath)) {
        return Promise.reject(new Error('No Module Package with version ' + version + ' for module.'));
      }

      return UtilFs.unlink(filepath)
      .then((result) => {
        // Remove the package version from the module information
        delete mod.packageVersions[version];

        // Check if the module should be in the module list anymore
        if (!this._shouldKeepModule(mod)) {
          this._removeModuleFromModuleList(mod);
        }

        logger.debug('Removed module package', {
          name: name,
          version: version
        });

        this.emit('module list change', this._modules);
        this._messenger.reportModules(this._getModuleList());

        return this._getModuleFromName(name);
      });
    }

    _shouldKeepModule(mod) {
      return mod.isInstalled || 0 < Object.keys(mod.packageVersions).length;
    }

    _removeModuleFromModuleList(mod) {
      let index = this._getModuleIndexFromName(mod.name);
      if (0 > index) {
        return;
      } else {
        this._modules.splice(index, 1);
      }
    }

    _determineUninstallOrder(modules) {
      return this._buildDependencyGraphFromModules(modules)
      .then((g) => {
        let t = new Topological(g);

        // Check if there is an order
        if (!t.hasOrder()) {
          return Promise.reject(new Error('Cannot determine unload order'));
        }

        const order = t.order().map((i) => modules[i]);
        return order;
      });
    }

    getModuleDependentList(name) {
      let modIndex = this._getModuleIndexFromName(name);
      if (0 > modIndex) {
        return Promise.reject(new Error('No module found with name "' + name + '".'));
      }

      return this.getModuleList()
      .then((modules) => {
        return this._buildDependentGraphFromModules(modules)
        .then((g) => {
          // Find the path to all dependents that are connected to this module
          let bfdp = new BreadthFirstDirectedPaths(g, modIndex);

          let deps = [];
          for (let i = 0; i < modules.length; i++) {
            if (bfdp.hasPathTo(i) && modIndex !== i) {
              deps.push(this._modules[i]);
            }
          }
          return deps;
        });
      });
    }

    getModuleDependencyList(name) {
      // Get the module from the module name
      let mod = this._getModuleFromName(name);
      if (!mod) {
        return Promise.reject(new Error('No module found with name "' + name + '".'));
      }

      if (!mod.isInstalled) {
        return Promise.reject(new Error('Module is not installed'));
      }

      // Create new modules array
      let moduleList = this._modules.map((mod) => mod);

      // Add missing dependency modules to module list
      const depNames = Object.keys(mod.dependencies);
      depNames.forEach((depName) => {
        const dep = this._getModuleFromName(depName, moduleList);
        if (!dep) {
          const tempDep = this._createModuleFromModuleInfo({
            name: depName
          });
          moduleList.push(tempDep);
        }
      });

      // Get module's index in the modules array
      let modIndex = this._getModuleIndexFromName(name);

      // Build the dependency graph
      return this._buildDependencyGraphFromModules(moduleList)
      .then((g) => {
        // Find the path to all dependents that are connected to this module
        let bfdp = new BreadthFirstDirectedPaths(g, modIndex);

        let deps = [];
        for (let i = 0; i < moduleList.length; i++) {
          if (bfdp.hasPathTo(i) && modIndex !== i) {
            // The dependency module
            let depMod = moduleList[i];

            // The version of the dependency
            let depVersion = depMod.installedVersion;

            // Required dependency version maybe in defineFind in a dependency of the
            // requested module. To find the correct required dependency version
            // find the path to the dependency. If the path has length one then
            // the requested module is the parent of the dependency otherwise the
            // second from the last in the path is the parent of the dependency.

            // Get the path to the dependent module
            let pathTo = bfdp.pathTo(i);

            // Add the requested module onto the beginning of the path
            pathTo.unshift(modIndex);

            // The pathTo list should be at least length 2
            if (2 > pathTo.length) {
              throw new Error('The pathTo length is less than 2 for dependency: ' + depMod.name);
            }

            // Index of the dependency's parent module
            let depParModIndex = pathTo[pathTo.length - 2];

            // The dependency's parent module
            let depParMod = moduleList[depParModIndex];

            // This is the verion requirement of the dependency of the requested
            // module.
            let modDepVersion = depParMod.dependencies[depMod.name];

            // Push dependency module information
            deps.push({
              name: depMod.name,
              installedDisplayName: depMod.installedDisplayName,
              isInstalled: depMod.isInstalled,
              isLoaded: depMod.isLoaded,
              installedVersion: depVersion,
              requiredVersion: modDepVersion,
              isVersionSatisified: this._satisfies(depVersion, modDepVersion),
            });
          }
        }

        return deps;
      });
    }

    _getModuleFromName(name, mods) {
      mods = mods || this._modules;
      let modIndex = this._getModuleIndexFromName(name, mods);
      if (0 > modIndex) {
        return null;
      } else {
        return mods[modIndex];
      }
    }

    getModuleFromName(name, mods) {
      return Promise.resolve(this._getModuleFromName(name, mods));
    }

    _getModuleIndexFromName(name, mods) {
      mods = mods || this._modules;
      for (let i = 0; i < mods.length; i++) {
        let mod = mods[i];
        if (name === mod.name) {
          return i;
        }
      }
      return -1;
    }

    _getModulesFromName(names) {
      return Promise.all(names.map((name) => {
        let mod = this._getModuleFromName(name);
        if (mod) {
          return Promise.resolve(mod);
        } else {
          return Promise.reject(new Error('No module found with name "' + name + '".'));
        }
      }));
    }

    _buildDependentGraphFromModules(mods) {
      const g = new Digraph(mods.length);
      mods.forEach((mod, index) => {
        if ('object' === typeof(mod.dependencies) && null !== mod.dependencies) {
          const depNames = Object.keys(mod.dependencies);

          depNames.forEach((depName) => {
            const depIndex = this._getModuleIndexFromName(depName, mods);

            if (0 > depIndex) {
              return;
            }

            g.addEdge(depIndex, index);
          });
        }
      });
      return Promise.resolve(g);
    }

    _buildDependencyGraphFromModules(mods) {
      return this._buildDependentGraphFromModules(mods)
      .then((g) => g.reverse());
    }

    getModuleList() {
      return Promise.resolve(this._getModuleList());
    }

    _addModuleManagerEndpoint() {
      // Add the 'modules' endpoint
      this._baseServer.use('/api/base/modules', this._router.getRouter());
    }

    addModulePackage(filepath) {
      // Decrypt the module
      return this._cryptoManager.decryptFile(filepath, this._modulesPackagesDecryptedDir)
      .catch((err) => {
        if (!ALLOW_NON_ENCRYPTED_MODULE_PACKAGES) {
          return Promise.reject(err);
        }

        return this.getModuleInfoFromModulePackage(filepath)
        .then((moduleInfo) => {
          const name = moduleInfo.name;
          const version = moduleInfo.version;
          const filename = name + '-' + version + '.tgz';
          const newPath = path.resolve(this._modulesPackagesDecryptedDir, filename);
          return UtilFs.rename(filepath, newPath)
          .then(() => {
            return newPath;
          });
        });
      })
      .then((decryptedFilePath) => {
        // Get the extname for the decrypted file
        let extname = path.extname(decryptedFilePath);
        // Get the basename to move to modules packages directory
        let basename = path.basename(decryptedFilePath, extname);
        // Create the full filpath of the new file ot the modules packages directory
        let modulePackageFilePath = path.resolve(this._modulesPackegesDir, basename + '.tgz');
        // Check if the module package filename already exists
        return UtilFs.stat(modulePackageFilePath)
        .then(() => {
          // File exists, REJECT!
          return UtilFs.unlink(decryptedFilePath)
          .catch(() => {
            logger.warn('Failed to remove decrypted file: %s', decryptedFilePath);
          })
          .then(() => {
            return Promise.reject(new Error('Module package file already exists.'));
          });
        }, () => {
          // No file, continue
          return Promise.resolve();
        })
        // Move the decrypted module package to the modules packages directory
        .then(() => {
          return UtilFs.rename(decryptedFilePath, modulePackageFilePath);
        })
        // Return the module package file path so it can be used later
        .then(() => {
          return modulePackageFilePath;
        });
      })
      // Extract module information from compressed module package
      .then((modulePackageFilePath) => {
        return this.extractModulePackageInfo(modulePackageFilePath)
        .then((moduleInfo) => {
          logger.debug('Added module package', {
            name: moduleInfo,
            version: moduleInfo.version
          });
          this.emit('module list change', this._modules);
          this._messenger.reportModules(this._getModuleList());
          return moduleInfo;
        })
        .then(null, (err) => {
          // Clean up the module package file
          return UtilFs.unlink(modulePackageFilePath)
          .then(null, (err) => {
            // Interesting that we got an error here, just absorb it and move on
            logger.warn('...Error removing module package file: %s', err.toString());
          })
          .then(() => {
            // The module extraction failed to reject with that error
            return Promise.reject(err);
          });
        });
      })
      .catch((err) => logger.error(`Failed to decrypt module package: ${err.message}`));
    }

    upgradeBase(filepath) {
      const now = Date.now();
      if (UPGRADE_BASE_CHECK_TIME > now) {
        return Promise.reject(new Error('System time must be updated through BITS Settings'));
      } else {
        return this._runUpgradeBaseScript(filepath);
      }
    }

    _runUpgradeBaseScript(filepath) {
      // First extract the upgrade-base script from the new base
      let extractArgs = [
        'xf', filepath,
        '--no-anchored',
        '--transform', 's/.*\\///g',
        '-C', '/tmp',
        'upgrade-base',
      ];

      let args = [
        this._upgradeBaseCommand,
        '-t', filepath, // The file path to the .tgz file of the base to upgrade with
        '-P', ROOT_DIR,
      ];

      // Create options for the upgrade-base script
      let options = {
        cwd: '/tmp', // upgrade script must run in script directory for linux
      };

      // Spawn the upgrade-base script process
      return UtilChildProcess.createSpawnPromise('tar', extractArgs, options)
      .then((result) => {
        if (0 !== result.code) {
          return Promise.reject(new Error('Failed to extract upgrade-base from tar: ' + result.code));
        }
      })
      .then(() => {
        logger.debug('Extracted the upgrade-base script from %s', filepath);
        logger.debug('Running', args, options);
        return new Promise((resolve, reject) => {
          setTimeout(() => { // If the base upgrade works the node process will die before this fires
            reject('Unknown error with upgrade base timout occured');
          }, 10000);
          return UtilChildProcess.createSpawnPromise('whereis', ['systemd-run'], options)
          .then((result) => {
            let exists = result.stdout.toString().split(/[ ]+/).length;
            if (exists > 1) {
              return UtilChildProcess.createSpawnPromise('systemd-run', args, options);
            } else {
              return UtilChildProcess.createSpawnPromise('setsid', args, options)
              .then((result) => {
                if (0 === result.code) {
                  // The last output of the script
                  let lastOut = result.stdout[result.stdout.length - 1].trim();
                  // Return the file path to the decrypted module
                  return lastOut;
                } else if (1 === result.code) {
                  return reject(new Error('incorrect arguments supplied'));
                } else if (2 === result.code) {
                  return reject(new Error('base backup failed'));
                } else if (3 === result.code) {
                  return reject(new Error('new base installation failed, aborted new base installation'));
                }
              });
            }
          });
        });
      });
    }


    getModuleApi(name) {
      // Get the module Object
      let mod = this._getModuleFromName(name);
      if ('object' !== typeof(mod) || null === mod) {
        return Promise.reject(new Error('no module found with name ' + name));
      }
      if (!mod.indexJs) {
        return Promise.reject(new Error('module has no api'));
      }
      return Promise.resolve(mod.indexJs);
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
  }

  module.exports = ModuleManager;
})();
