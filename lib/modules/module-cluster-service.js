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
    }

    load(messageCenter) {
      logger.debug('Loading the cluster service');
      cluster.on('exit', this._boundOnExit);
      this._activityApi = new ActivityApi(messageCenter);

      return Promise.resolve();
    }

    unload() {
      return Promise.resolve();
    }

    summonTheModule(mod) {
      if(this._modules.hasOwnProperty(mod.id)) {
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
        logger.warn('Can not clean up module because we are not running it - continuing on ...'); //Will happen on clean up of a module that crashes during load;
        return Promise.resolve();
      } else {
        return Promise.resolve()
        .then(() => this._unregisterChildProcessHandlers(this._modules[mod.id], mod))
        .then(() => {
          delete this._modules[mod.id];
        });
      }
    }

    moduleCompletedLoad(mod) {
      if (this._modules.hasOwnProperty(mod.id)) {
        return this._removeLoadListeners(mod)
        .then(() => this._registerChildProcessHandlers(this._modules[mod.id], mod));
      } else {
        return Promise.reject(new Error('unable to swap listeners - module not found'));
      }
    }

    _exitHandler(mod, pid) {
      logger.error('-----------------------------\n');
      logger.error('Module %s died cleaning up now', mod.name);
      return Promise.resolve()
      .then(() => this.destroyTheModule(mod))
      .then(() => this._manager.unloadModule(mod.id))
      .then(() => {
        console.log('**************************');
        console.log('Module finished being destroyed', this._modules);
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

      if( this._loadExitHandlers.hasOwnProperty(mod.id)) {
        logger.error('Already loaded module unable to add load handlers');
        return Promise.reject(new Error('Already loaded this module'));
      }
      this._loadExitHandlers[mod.id] = (pid) => {
        delete this._modules[mod.id];
        this.emit('failed-load', mod);
      }
      modProcess.process.on('exit', this._loadExitHandlers[mod.id]);
    }

    _removeLoadListeners(mod) {
      if( !this._loadExitHandlers(mod.id) || !this._modules.hasOwnProperty(mod.id)) {
        logger.error('Can not remove load listeners from non running module');
      } else {
        const modProcess = this._modules[mod.id];
        modProcess.process.removeListener('exit', this._loadExitHandlers[mod.id]);
      }
      delete this._loadExitHandlers[mod.id];
    }

    _registerChildProcessHandlers(modInfo, mod) {
      modInfo.exitHandler = this._exitHandler.bind(this, mod);
      modInfo.process.on('exit', modInfo.exitHandler);
      return Promise.resolve();
    }

    _unregisterChildProcessHandlers(modInfo, mod) {
      if(modInfo.hasOwnProperty(process) && mod.hasOwnProperty(exitHandler)) {
        mod.process.removeListener('exit', mod.exitHandler);
        mod.exitHandler = null;
      } else {
        logger.warn('Could not unregister CHild Process Handlers because module does not exist', mod);
      }
      return Promise.resolve();
    }

    _onExit(pid) {
      logger.error('Client with pid %s died a horrible death', pid.process.pid);
    }
  }

  module.exports = ModuleClusterService;
})();
