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

  const Constants = require('./system-constants');
  const SCOPES = null;

  class SystemApi {
    static get TAG() {
      return 'base#Scopes';
    }

    constructor(messageCenter) {
      this._messageCenter = messageCenter;
    }

    getTime() {
      return this._messageCenter.sendRequest(Constants.REQUEST.TIME_GET, {scopes: SCOPES});
    }

    setTime(time) {
      return this._messageCenter.sendRequest(Constants.REQUEST.TIME_SET, {scopes: SCOPES}, time);
    }

    getBitsId() {
      return this._messageCenter.sendRequest(Constants.REQUEST.BITS_ID, {scopes: SCOPES});
    }

    restart() {
      return this._messageCenter.sendRequest(Constants.REQUEST.RESTART, {scopes: SCOPES});
    }

    shutdown() {
      return this._messageCenter.sendRequest(Constants.REQUEST.SHUTDOWN, {scopes: SCOPES});
    }
  }

  module.exports = SystemApi;
})();
