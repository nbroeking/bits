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

  class LoggingApi {
    static get TAG() {
      return 'base#Logging';
    }

    static get REQUEST() {
      return {
        GENERATE_CRASH_DUMP: `${LoggingApi.TAG} generateCrashDump`,
        ADD_LOG_DIRECTORY: `${LoggingApi.TAG} addLogDirectory`,
        REMOVE_LOG_DIRECTORY: `${LoggingApi.TAG} removeLogDirectory`
      };
    }

    constructor(messageCenter) {
      this._messageCenter = messageCenter;
    }

    generateCrashDump(request) {
      return this._messageCenter.sendRequest(LoggingApi.REQUEST.GENERATE_CRASH_DUMP, {scopes: null}, request);
    }

    addLogDirectory(request) {
      return this._messageCenter.sendRequest(LoggingApi.REQUEST.ADD_LOG_DIRECTORY, {scopes: null}, request);
    }

    removeLogDirectory(request) {
      return this._messageCenter.sendRequest(LoggingApi.REQUEST.REMOVE_LOG_DIRECTORY, {scopes: null}, request);
    }
  }

  module.exports = LoggingApi;
})();
