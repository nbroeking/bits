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
  'use-strict';

  const Messenger = require('./dispatch-messenger');
  const ModuleMasterApi = require('../modules/module-master-api');
  const path = require('path');
  const UtilFs = require('./../helpers/fs');

  const logger = require('./../logging/logger-factory').getLogger();

  class Dispatcher {
    constructor(mod) {
      this._boundProcessSeriousError = this._processSeriousError.bind(this);
      this._boundDie = this.die.bind(this);
      this._messenger = new Messenger(this, mod);
      this._module = mod;
    }

    load(messageCenter) {
      this._moduleApi = new ModuleMasterApi(messageCenter, this._module);
      this._messageCenter = messageCenter;
      return this._messenger.load(messageCenter)
      .then(() => logger.debug(`Dispatcher loaded.  Ready to load module ${this._module.name}`))
      .then(() => this._dispatchModule());
    }

    unload() {
      return this._messenger.unload();
    }

    _processSeriousError(err) {
      return this._moduleApi.loadComplete({err: err})
      .catch((err) => logger.error('Unable to process serious error', err));
    }

    die() {
      const mod = this._module;
      return Promise.resolve()
      .then(() => this._callModuleIndexJsUnload(mod))
      .then(() => {
        Promise.resolve() // No Return we want the base to get the response to the request
        .then(() => {
          process.exit(0);
        });
      });
    }

    _callModuleIndexJsUnload(mod) {
      if (mod.indexJs && 'function' === typeof(mod.indexJs.unload)) {
        return Promise.resolve()
        .then(() => mod.indexJs.unload(this._messageCenter));
      } else {
        return Promise.resolve();
      }
    }

    // Should only be called from child process
    _dispatchModule() {
      const processSeriousError = (err) => {
        return this._moduleApi.loadComplete({err: err})
        .catch((err) => {
          logger.error('Unable to process serious error', err);
          return Promise.reject(err);
        });
      };

      process.on('SIGTERM', () => {
        setTimeout(() => {
          logger.debug('We have been asked to exit so now were dying');
          process.exit(0);
        });
      });

      return Promise.resolve()
      .then(() => {
        process.on('uncaughtException', processSeriousError);
        process.on('unhandledRejection', processSeriousError);
      })
      .then(() => this._loadModuleIndexJs(this._module))
      // Call load on module's index.js
      .then(() => this._callModuleIndexJsLoad(this._module, this._messageCenter))
      .then((result) => {
        return this._moduleApi.loadComplete({result: result});
      })
      .then(() => {
        process.removeListener('uncaughtException', processSeriousError);
        process.removeListener('unhandledRejection', processSeriousError);
      })
      .catch((err) => {
        let error = err;
        if (err) {
          if (err instanceof Error) {
            error = {
              name: err.name,
              message: err.message
            };
          } else {
            error = err.error || err;
          }
        } else {
          error = {message: 'Unknown Error Occurred'};
        }

        process.removeListener('uncaughtException', processSeriousError);
        process.removeListener('unhandledRejection', processSeriousError);

        return this._moduleApi.loadComplete({err: {message: error.message}})
        .then(() => Promise.reject(error));
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

    _callModuleIndexJsLoad(mod) {
      if (mod.indexJs) {
        if ('function' === typeof(mod.indexJs.load)) {
          return Promise.resolve()
          .then(() => mod.indexJs.load(this._messageCenter))
          .catch((err) => {
            return Promise.reject(err);
          });
        } else {
          return Promise.reject(new Error('index js does not define load'));
        }
      } else {
        logger.warn(`${mod.name} does not have an index.js skipping`);
        return Promise.resolve(mod);
      }
    }
  };

  module.exports = Dispatcher;
})();
