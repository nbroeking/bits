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

  const Messenger = require('./../helpers/messenger');
  const KeysApi = require('./key-api');

  class KeysMessenger extends Messenger {
    constructor(manager) {
      super();
      this._manager = manager;
      this.addRequestListener(KeysApi.REQUEST.CREATE, KeysApi.SCOPES, this._create.bind(this));
      this.addRequestListener(KeysApi.REQUEST.LIST, KeysApi.SCOPES, this._list.bind(this));
      this.addRequestListener(KeysApi.REQUEST.DELETE, KeysApi.SCOPES, this._delete.bind(this));
      this.addRequestListener(KeysApi.REQUEST.GET_DEVICE_KEY, KeysApi.SCOPES, this._getDeviceKey.bind(this));
      this.addRequestListener(KeysApi.REQUEST.GET_SIGNATURE_KEY, KeysApi.SCOPES, this._getSignatureKey.bind(this));
    }

    _create(metadata, request) {
      return this._manager.create(request);
    }

    _list() {
      return this._manager.list();
    }

    _delete(metadata, request) {
      return this._manager.delete(request);
    }

    _getDeviceKey() {
      return this._manager.getDevicePrivateKey();
    }

    _getSignatureKey() {
      return this._manager.getBitsSignaturePublicKey();
    }
  }

  module.exports = KeysMessenger;
})();
