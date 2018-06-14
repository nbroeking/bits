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

  const SCOPES = null;

  const Messenger = require('./../helpers/messenger');
  const EventEmitter = require('events');

  const LOAD_PROCESS_FINISH_EVENT = 'base#BaseModuleFinishedLoad';

  class ModuleMasterMessenger extends Messenger {
    constructor(manager) {
      super();

      this._eventEmitter = new EventEmitter();
      this._manager = manager;
      this.addEventListener(LOAD_PROCESS_FINISH_EVENT, {scopes: SCOPES}, this._loadComplete.bind(this));
    }

    _loadComplete(message) {
      this._eventEmitter.emit('module-response', message.module, message.err, message.result);
    }

    on(event, listener) {
      this._eventEmitter.on(event, listener);
    }

    removeListener(event, listener) {
      this._eventEmitter.removeListener(event, listener);
    }
  }

  module.exports = ModuleMasterMessenger;
})();
