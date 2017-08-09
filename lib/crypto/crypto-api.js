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

  class CryptoApi {
    static get TAG() {
      return 'base#Crypto';
    }

    static get SCOPES() {
      return null;
    }

    static get REQUEST() {
      return {
        DECRYPT_FILE: `${CryptoApi.TAG} decryptFile`,
        DECRYPT_FILE_WITH_KEY: `${CryptoApi.TAG} decryptFileWithKey`,
        ENCRYPT_FILE: `${CryptoApi.TAG} encryptFile`,
        ENCRYPT_FILE_WITH_AVAILABLE_KEYS: `${CryptoApi.TAG} encryptFileWithAvailableKeys`,
      };
    }

    constructor(messageCenter) {
      this._messageCenter = messageCenter;
    }

    decryptFile(request) {
      return this._messageCenter.sendRequest(CryptoApi.REQUEST.DECRYPT_FILE, {scopes: CryptoApi.SCOPES}, request);
    }

    decryptFileWithKey(request) {
      return this._messageCenter.sendRequest(CryptoApi.REQUEST.DECRYPT_FILE_WITH_KEY, {scopes: CryptoApi.SCOPES}, request);
    }

    encryptFile(request) {
      return this._messageCenter.sendRequest(CryptoApi.REQUEST.ENCRYPT_FILE, {scopes: CryptoApi.SCOPES}, request);
    }

    encryptFileWithAvailableKeys(request) {
      return this._messageCenter.sendRequest(CryptoApi.REQUEST.ENCRYPT_FILE_WITH_AVAILABLE_KEYS, {scopes: CryptoApi.SCOPES}, request);
    }
  }

  module.exports = CryptoApi;
})();
