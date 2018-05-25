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

  const logger = require('../logging/logger-factory').getLogger();
  const cluster = require('cluster');
  const EventEmitter = require('events');

  const ActivityApi = require('./../activity/activity-api');

  class ModuleClusterService extends EventEmitter {
    constructor(manager) {
      super();
      this._boundOnExit = this._onExit.bind(this);
      this._manager = manager;
      this._modules = {};
      this._loadExitHandlers = {};
      this._unloadExitHandlers = {};
    }

    load(messageCenter) {
      this._messageCenter = messageCenter;
      logger.debug('Loading the cluster service');
      cluster.on('exit', this._boundOnExit);
      this._activityApi = new ActivityApi(messageCenter);

      return Promise.resolve();
    }

    unload() {
      return Promise.resolve();
    }

    summonTheModule(mod) {
      if (this._modules.hasOwnProperty(mod.id)) {
        return Promise.reject(new Error(`Already running module ${mod.name}`));
      } else {
        this._modules[mod.id] = {
          id: mod.id,
          name: mod.name,
          process: null
        };
        let env = {};
        env.mod = JSON.stringify(mod);
        this._modules[mod.id].process = cluster.fork(env);

        return Promise.resolve()
        .then(() => this._registerLoadListeners(mod));
      }
    }

    destroyTheModule(mod) {
      if (!this._modules.hasOwnProperty(mod.id)) {
        logger.warn('Can not clean up module because we are not running it - continuing on ...'); // Will happen on clean up of a module that crashes during load;
        return Promise.resolve();
      } else {
        return Promise.resolve()
        .then(() => {
          const modToKill = this._modules[mod.id];
          if (modToKill.hasOwnProperty('process')) {
            modToKill.process.kill();
          } else {
            logger.warn('No process to kill. This is unusual');
          }
          return Promise.resolve();
        })
        .then(() => this._destroyAllListeners(mod))
        .then(() => this._messageCenter.cleanUpWorker(this._modules[mod.id].process))
        .then(() => {
          delete this._modules[mod.id];
        });
      }
    }

    _destroyAllListeners(mod) {
      const process = this._modules[mod.id].process;
      if (!process) {
        logger.error('No process to remove listeners for. This is unusual but not impossible');
        return;
      }

      if (this._unloadExitHandlers.hasOwnProperty(mod.id)) {
        process.removeListener('exit', this._unloadExitHandlers[mod.id]);
        delete this._unloadExitHandlers[mod.id];
      }

      if (this._loadExitHandlers.hasOwnProperty(mod.id)) {
        process.removeListener('exit', this._loadExitHandlers[mod.id]);
        delete this._loadExitHandlers[mod.id];
      }

      if (mod.hasOwnProperty('exitHandler')) {
        process.removeListener('exit', process.exitHandler);
        delete mod.exitHandler;
      }
    }

    moduleCompletedLoad(mod) {
      if (this._modules.hasOwnProperty(mod.id)) {
        return this._unregisterLoadListeners(mod)
        .then(() => this._registerChildProcessHandlers(this._modules[mod.id], mod));
      } else {
        return Promise.reject(new Error('unable to swap listeners - module not found'));
      }
    }

    moduleUnloading(mod) {
      return this._unregisterChildProcessHandlers(this._modules[mod.id], mod)
      .then(() => {
        this._unloadExitHandlers[mod.id] = () => {
          this.emit('module-unloaded', mod);
        };
        this._modules[mod.id].process.once('exit', this._unloadExitHandlers[mod.id]);
      });
    }

    _exitHandler(mod, pid) {
      logger.error('Module %s died cleaning up now', mod.name);
      return Promise.resolve()
      .then(() => this._manager.moduleCrashed(mod.id))
      .then(() => {
        logger.debug('Cleaned up module from crash');
        return this._activityApi.create({
          title: `Module ${mod.name} has crashed.`,
          projectName: 'Base Modules',
          icon: 'icons:error',
        });
      })
      .catch((err) => {
        logger.error('Unable to clean up after a crashed child %s', mod.name, err);
      });
    }

    _registerLoadListeners(mod) {
      const modProcess = this._modules[mod.id];
      logger.debug(`Adding load listeners for ${mod.name}`);

      if (this._loadExitHandlers.hasOwnProperty(mod.id)) {
        logger.error('Already loaded module unable to add load handlers');
        return Promise.reject(new Error('Already loaded this module'));
      }
      this._loadExitHandlers[mod.id] = (pid) => {
        delete this._modules[mod.id];
        this.emit('failed-load', mod);
      };
      modProcess.process.on('exit', this._loadExitHandlers[mod.id]);
    }

    _unregisterLoadListeners(mod) {
      if (!this._loadExitHandlers.hasOwnProperty(mod.id) || !this._modules.hasOwnProperty(mod.id)) {
        logger.error('Can not remove load listeners from non running module');
      } else {
        const modProcess = this._modules[mod.id];
        modProcess.process.removeListener('exit', this._loadExitHandlers[mod.id]);
      }
      delete this._loadExitHandlers[mod.id];
      return Promise.resolve();
    }

    _registerChildProcessHandlers(modInfo, mod) {
      modInfo.exitHandler = this._exitHandler.bind(this, mod);
      modInfo.process.on('exit', modInfo.exitHandler);
      return Promise.resolve();
    }

    _unregisterChildProcessHandlers(modInfo, mod) {
      if (modInfo.hasOwnProperty('process')) {
        modInfo.process.removeListener('exit', modInfo.exitHandler);
      } else {
        logger.warn('Could not unregister child Process Handlers because module does not exist', mod);
      }
      delete modInfo.exitHandler;
      return Promise.resolve();
    }

    _onExit(pid) {
      logger.error('Client with pid %s died a horrible death', pid.process.pid);
    }
  }

  module.exports = ModuleClusterService;
})();
