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

  const BaseModuleApi = require('./../modules/module-api');
  const logger = global.LoggerFactory.getLogger();

  class LazyLoad {
    constructor({moduleName=null, onLoaded=null, onUnloaded=null}={}) {
      if ('string' !== typeof(moduleName)) {
        throw new TypeError('moduleName must be a string');
      }
      this._moduleName = moduleName;
      if ('function' !== typeof(onLoaded)) {
        throw new TypeError('onLoaded must be a function');
      }
      this._onLoaded = onLoaded;
      if ('function' !== typeof(onUnloaded)) {
        throw new TypeError('onUnloaded must be a function');
      }
      this._onUnloaded = onUnloaded;

      this._isLoaded = false;
      this._messageCenter = null;
      this._moduleApi = null;
      this._boundOnList = this._onList.bind(this);
    }

    load(messageCenter) {
      return Promise.resolve()
      .then(() => {
        this._messageCenter = messageCenter;
        this._moduleApi = new BaseModuleApi(messageCenter);
      })
      .then(() => this._moduleApi.addCreatedListener(this._boundOnList))
      .then(() => this._moduleApi.addUpdatedListener(this._boundOnList))
      .then(() => this._moduleApi.addDeletedListener(this._boundOnList))
      .then(() => this._onList());
    }

    unload() {
      return Promise.resolve()
      .then(() => this._moduleApi.removeCreatedListener(this._boundOnList))
      .then(() => this._moduleApi.removeUpdatedListener(this._boundOnList))
      .then(() => this._moduleApi.removeDeletedListener(this._boundOnList))
      .then(() => this._onList())
      .then(() => {
        this._moduleApi = null;
        this._messageCenter = null;
      });
    }

    _onList() {
      // allow all base module event listeners to run before triggering lazy-loading
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          Promise.resolve()
          .then(() => this._moduleApi.list())
          .then((modules) => {
            const moduleInfo = modules.find((moduleInfo) => this._moduleName === moduleInfo.name);
            const isLoaded = moduleInfo && moduleInfo.isLoaded;
            if (isLoaded && !this._isLoaded) {
              logger.debug(`Trigger lazy load for ${this._moduleName}`);
              this._isLoaded = true;
              return this._onLoaded(this._messageCenter);
            } else if (!isLoaded && this._isLoaded) {
              logger.debug(`Trigger lazy unload for ${this._moduleName}`);
              this._isLoaded = false;
              return this._onUnloaded();
            }
          })
          .then(resolve);
        });
      });
    }
  }

  module.exports = LazyLoad;
})();
