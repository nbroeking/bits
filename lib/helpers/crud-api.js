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

  const ScopesUtil = require('./../scopes/scopes-util');

  class CrudApi {
    static get DEFAULT_SCOPES() {
      return null;
    }

    static isValidTag(tag) {
      return 'string' == typeof(tag) && 0 < tag.length;
    }

    constructor(tag, messageCenter, {scopes=CrudApi.DEFAULT_SCOPES}={}) {
      if (!CrudApi.isValidTag(tag)) {
        throw new TypeError('tag must be a non-empty string.');
      }
      this._tag = tag;

      // TODO: Validiate messageCenter
      this._messageCenter = messageCenter;

      if (!ScopesUtil.isValidScopes(scopes)) {
        scopes = CrudApi.DEFAULT_SCOPES;
      }
      this._scopes = scopes;
    }

    create(item) {
      return this._messageCenter.sendRequest(`${this._tag} create`, {scopes: this._scopes}, item);
    }

    count(query) {
      return this._messageCenter.sendRequest(`${this._tag} count`, {scopes: this._scopes}, query);
    }

    list(query, options) {
      return this._messageCenter.sendRequest(`${this._tag} list`, {scopes: this._scopes}, query, options);
    }

    get(id) {
      return this._messageCenter.sendRequest(`${this._tag} get`, {scopes: this._scopes}, id);
    }

    update(id, update) {
      return this._messageCenter.sendRequest(`${this._tag} update`, {scopes: this._scopes}, id, update);
    }

    delete(id) {
      return this._messageCenter.sendRequest(`${this._tag} delete`, {scopes: this._scopes}, id);
    }

    addCreatedListener(listener) {
      return this._messageCenter.addEventListener(`${this._tag} created`, this._scopes, listener);
    }

    removeCreatedListener(listener) {
      return this._messageCenter.removeEventListener(`${this._tag} created`, this._scopes, listener);
    }

    addUpdatedListener(listener) {
      return this._messageCenter.addEventListener(`${this._tag} updated`, this._scopes, listener);
    }

    removeUpdatedListener(listener) {
      return this._messageCenter.removeEventListener(`${this._tag} updated`, this._scopes, listener);
    }

    addDeletedListener(listener) {
      return this._messageCenter.addEventListener(`${this._tag} deleted`, this._scopes, listener);
    }

    removeDeletedListener(listener) {
      return this._messageCenter.removeEventListener(`${this._tag} deleted`, this._scopes, listener);
    }
  }

  module.exports = CrudApi;
})();
