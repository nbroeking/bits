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

  const SCOPES = null;

  const HELPER = require('./helper-constants');

  class HelperApi {
    constructor(messageCenter) {
      this._messageCenter = messageCenter;
    }

    list() {
      return this._messageCenter.sendRequest(HELPER.REQUEST.LIST, {scopes: SCOPES});
    }

    add(helper) {
      return this._messageCenter.sendRequest(HELPER.REQUEST.ADD, {scopes: SCOPES}, helper);
    }

    addAddedListener(listener) {
      return this._messageCenter.addEventListener(HELPER.EVENT.ADDED, SCOPES, listener);
    }

    removeAddedListener(listener) {
      return this._messageCenter.removeEventListener(HELPER.EVENT.ADDED, listener);
    }
  }

  module.exports = HelperApi;
})();
