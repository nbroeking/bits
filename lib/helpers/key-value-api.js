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

  class KeyValueApi extends EventEmitter {
    static isValidTag(tag) {
      return 'string' === typeof(tag) && 0 < tag.length;
    }

    constructor(tag, messageCenter) {
      super();
      if (!KeyValueApi.isValidTag(tag)) {
        throw new TypeError('tag must be a non-empty string.');
      }
      this._tag = tag;
      this._messageCenter = messageCenter;
      this._boundOnSet = this._onSet.bind(this);
      this._boundOnDelete = this._onDelete.bind(this);
      this._boundOnClear = this._onClear.bind(this);
    }

    set(request) {
      return this._messageCenter.sendRequest(`${this._tag} set`, {scopes: null}, request);
    }

    get(request) {
      return this._messageCenter.sendRequest(`${this._tag} get`, {scopes: null}, request);
    }

    has(request) {
      return this._messageCenter.sendRequest(`${this._tag} has`, {scopes: null}, request);
    }

    delete(request) {
      return this._messageCenter.sendRequest(`${this._tag} delete`, {scopes: null}, request);
    }

    clear(request) {
      return this._messageCenter.sendRequest(`${this._tag} clear`, {scopes: null}, request);
    }

    keys(request) {
      return this._messageCenter.sendRequest(`${this._tag} keys`, {scopes: null}, request);
    }

    values(request) {
      return this._messageCenter.sendRequest(`${this._tag} values`, {scopes: null}, request);
    }

    addSetListener(listener) {
      return this._messageCenter.addEventListener(`${this._tag} set`, {scopes: null}, listener);
    }

    removeSetListener(listener) {
      return this._messageCenter.removeEventListener(`${this._tag} set`, listener);
    }

    addDeleteListener(listener) {
      return this._messageCenter.addEventListener(`${this._tag} delete`, {scopes: null}, listener);
    }

    removeDeleteListener(listener) {
      return this._messageCenter.removeEventListener(`${this._tag} delete`, listener);
    }

    addClearListener(listener) {
      return this._messageCenter.addEventListener(`${this._tag} clear`, {scopes: null}, listener);
    }

    removeClearListener(listener) {
      return this._messageCenter.removeEventListener(`${this._tag} clear`, listener);
    }

    load() {
      return Promise.resolve()
      .then(() => this.addSetListener(this._boundOnSet))
      .then(() => this.addDeleteListener(this._boundOnDelete))
      .then(() => this.addClearListener(this._boundOnClear));
    }

    unload() {
      return Promise.resolve()
      .then(() => this.removeSetListener(this._boundOnSet))
      .then(() => this.removeDeleteListener(this._boundOnDelete))
      .then(() => this.removeClearListener(this._boundOnClear));
    }

    _onSet({key, value}) {
      this.emit('set', {key: key, value: value});
    }

    _onDelete({key}) {
      this.emit('delete', {key: key});
    }

    _onClear() {
      this.emit('clear');
    }
  }

  module.exports = KeyValueApi;
})();
