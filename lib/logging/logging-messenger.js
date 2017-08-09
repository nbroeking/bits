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

  const CrudMessenger = require('./../helpers/crud-messenger');
  const LoggingApi = require('./logging-api');

  class LoggingMessenger extends CrudMessenger {
    static get SCOPES() {
      return ['base'];
    }

    constructor(tag, manager, options) {
      super(tag, manager, options);
      this.addRequestListener(LoggingApi.REQUEST.GENERATE_CRASH_DUMP, {scopes: LoggingMessenger.SCOPES}, this._generateCrashDump.bind(this));
      this.addRequestListener(LoggingApi.REQUEST.ADD_LOG_DIRECTORY, {scopes: LoggingMessenger.SCOPES}, this._addLogDirectory.bind(this));
      this.addRequestListener(LoggingApi.REQUEST.REMOVE_LOG_DIRECTORY, {scopes: LoggingMessenger.SCOPES}, this._removeLogDirectory.bind(this));
    }

    _generateCrashDump(metadata, request) {
      if (!request) {
        request = undefined;
      }
      return this._manager.generateCrashDump(request);
    }

    _addLogDirectory(metadata, request) {
      return this._manager.addLogDirectory(request);
    }

    _removeLogDirectory(metadata, request) {
      return this._manager.removeLogDirectory(request);
    }
  }

  module.exports = LoggingMessenger;
})();
