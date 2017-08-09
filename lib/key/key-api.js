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

  class KeysApi {
    static get TAG() {
      return 'base#Keys';
    }

    static get SCOPES() {
      return null;
    }

    static get REQUEST() {
      return {
        CREATE: `${KeysApi.TAG} create`,
        LIST: `${KeysApi.TAG} list`,
        DELETE: `${KeysApi.TAG} delete`,
        GET_DEVICE_KEY: `${KeysApi.TAG} getDeviceKey`,
        GET_SIGNATURE_KEY: `${KeysApi.TAG} getSignatureKey`
      };
    }

    constructor(messageCenter) {
      this._messageCenter = messageCenter;
    }

    create(request) {
      return this._messageCenter.sendRequest(KeysApi.REQUEST.CREATE, {scopes: KeysApi.SCOPES}, request);
    }

    list() {
      return this._messageCenter.sendRequest(KeysApi.REQUEST.LIST, {scopes: KeysApi.SCOPES});
    }

    delete(request) {
      return this._messageCenter.sendRequest(KeysApi.REQUEST.DELETE, {scopes: KeysApi.SCOPES}, request);
    }

    getDevicePrivateKey() {
      return this._messageCenter.sendRequest(KeysApi.REQUEST.GET_DEVICE_KEY, {scopes: KeysApi.SCOPES});
    }

    getSignatureKey() {
      return this._messageCenter.sendRequest(KeysApi.REQUEST.GET_SIGNATURE_KEY, {scopes: KeysApi.SCOPES});
    }
  }

  module.exports = KeysApi;
})();
