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

  const EventEmitter = require('events');
  const cluster = require('cluster');

  const HelperApi = require('./helper-api');
  const HelperMessenger = require('./helper-messenger');
  const logger = global.LoggerFactory.getLogger();

  class HelperManager extends EventEmitter {
    constructor() {
      super();
      this._helpers = [];
      this._messenger = new HelperMessenger(this);
      this._boundAdded = this._added.bind(this);
      this._helperApi = null;
    }

    load(messageCenter) {
      return Promise.resolve()
      .then(() => {
        if (cluster.isMaster) {
          return this._loadMaster(messageCenter);
        } else {
          return this._loadWorker(messageCenter);
        }
      });
    }

    _loadMaster(messageCenter) {
      return Promise.resolve()
      .then(() => this._messenger.load(messageCenter));
    }

    _loadWorker(messageCenter) {
      return Promise.resolve()
      .then(() => {
        this._helperApi = new HelperApi(messageCenter);
      })
      .then(() => this._helperApi.list())
      .then((helpers) => this._added(helpers))
      .then(() => this._helperApi.addAddedListener(this._boundAdded));
    }

    unload() {
      return Promise.resolve()
      .then(() => {
        if (cluster.isMaster) {
          return this._unloadMaster();
        } else {
          return this._unloadWorker();
        }
      });
    }

    _unloadMaster() {
      return Promise.resolve()
      .then(() => this._messenger.unload());
    }

    _unloadWorker() {
      return Promise.resolve()
      .then(() => this._helperApi.removeAddedListener(this._boundAdded))
      .then(() => {
        this._helperApi = null;
      });
    }

    _added(helpers) {
      helpers.map(({name, filepath}) => global.helper.add(name, filepath));
      return Promise.resolve();
    }

    add(helper) {
      try {
        require(helper.filepath);
        global.helper.add(helper.name, helper.filepath);
      } catch (err) {
        logger.silly(err.stack);
        return Promise.reject(new Error(`Unable to load helper '${helper.name}' module: ${err.message}`));
      }
      const currentHelper = this._helpers.find((currentHelper) => helper.name === currentHelper.name);
      if (currentHelper) {
        const index = this._helpers.indexOf(currentHelper);
        this._helpers.splice(index, 1, helper);
      } else {
        this._helpers.push(helper);
      }
      this.emit('added', [helper]);
      return Promise.resolve(helper);
    }

    list() {
      return Promise.resolve(this._helpers);
    }
  }

  module.exports = HelperManager;
})();
