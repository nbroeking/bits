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
  const ScopesUtil = require('./../scopes/scopes-util');
  const Messenger = require('./messenger');
  const KeyValueApi = require('./key-value-api');

  class KeyValueMessenger extends Messenger {
    constructor(tag, manager, {scopes=null, readScopes=scopes, writeScopes=scopes}={}) {
      super();
      if (!KeyValueApi.isValidTag(tag)) {
        throw new TypeError('tag must be a non-empty string.');
      }
      this._tag = tag;
      if (!(manager instanceof EventEmitter)) {
        throw new TypeError('manager must be an EventEmitter.');
      }
      this._manager = manager;
      if (!ScopesUtil.isValidScopes(readScopes)) {
        throw new TypeError('readScopes must be an valid scopes.');
      }
      this._readScopes = readScopes;
      if (!ScopesUtil.isValidScopes(writeScopes)) {
        throw new TypeError('writeScopes must be an valid scopes.');
      }
      this._writeScopes = writeScopes;
      this.addRequestListener(`${this._tag} set`, {scopes: this._writeScopes}, this._set.bind(this));
      this.addRequestListener(`${this._tag} get`, {scopes: this._readScopes}, this._get.bind(this));
      this.addRequestListener(`${this._tag} has`, {scopes: this._readScopes}, this._has.bind(this));
      this.addRequestListener(`${this._tag} delete`, {scopes: this._writeScopes}, this._delete.bind(this));
      this.addRequestListener(`${this._tag} clear`, {scopes: this._writeScopes}, this._clear.bind(this));
      this.addRequestListener(`${this._tag} keys`, {scopes: this._readScopes}, this._keys.bind(this));
      this.addRequestListener(`${this._tag} values`, {scopes: this._readScopes}, this._values.bind(this));
      this.addEmitterEventListener(this._manager, 'set', this._onSet.bind(this));
      this.addEmitterEventListener(this._manager, 'delete', this._onDelete.bind(this));
      this.addEmitterEventListener(this._manager, 'clear', this._onClear.bind(this));
    }

    _set(metadata, request) {
      return this._manager.set(request);
    }

    _get(metadata, request) {
      return this._manager.get(request);
    }

    _has(metadata, request) {
      return this._manager.has(request);
    }

    _delete(metadata, request) {
      return this._manager.delete(request);
    }

    _clear(metadata, request) {
      return this._manager.clear(request);
    }

    _keys(metadata, request) {
      return this._manager.keys(request);
    }

    _values(metadata, request) {
      return this._manager.values(request);
    }

    _onSet({key, value}) {
      this.sendEvent(`${this._tag} set`, {scopes: this._readScopes}, {key: key, value: value});
    }

    _onDelete({key}) {
      this.sendEvent(`${this._tag} delete`, {scopes: this._readScopes}, {key: key});
    }

    _onClear() {
      this.sendEvent(`${this._tag} clear`, {scopes: this._readScopes});
    }
  }

  module.exports = KeyValueMessenger;
})();
