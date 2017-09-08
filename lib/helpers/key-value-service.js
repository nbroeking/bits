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

  const KeyValueManager = require('./key-value-manager');
  const KeyValueMessenger = require('./key-value-messenger');

  class KeyValueService {
    constructor(options) {
      this._options = options;
      this._manager = null;
      this._messenger = null;
    }

    load(messageCenter) {
      return Promise.resolve()
      .then(() => this.createManager(messageCenter, this._options))
      .then((manager) => {
        this._manager = manager;
      })
      .then(() => this.loadManager(messageCenter, this._manager))
      .then(() => this.createMessenger(this._manager, this._options))
      .then((messenger) => {
        this._messenger = messenger;
      })
      .then(() => this._messenger.load(messageCenter));
    }

    createManager(messageCenter, options) {
      const manager = new KeyValueManager();
      return Promise.resolve(manager);
    }

    createMessenger(manager, {tag, scopes, readScopes, writeScopes}={}) {
      const messengerOptions = {
        scopes: scopes,
        readScopes: readScopes,
        writeScopes: writeScopes
      };
      const messenger = new KeyValueMessenger(tag, manager, messengerOptions);
      return Promise.resolve(messenger);
    }

    loadManager(messageCenter, manager) {
      return Promise.resolve();
    }

    unload() {
      return Promise.resolve()
      .then(() => this._messenger.unload())
      .then(() => {
        this._messenger = null;
      })
      .then(() => this.unloadManager(this._manager))
      .then(() => {
        this._manager = null;
      });
    }

    unloadManager(manager) {
      return Promise.resolve();
    }
  }

  module.exports = KeyValueService;
})();
