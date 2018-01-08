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

  const ModuleConstants = require('./module-constants');

  class ModuleApi {
    constructor(messageCenter, {scopes=SCOPES}={}) {
      this._messageCenter = messageCenter;
      this._scopes = scopes;
    }

    list({scopes=this._scopes}={}) {
      return Promise.resolve()
      .then(() => this._messageCenter.sendRequest(ModuleConstants.REQUEST.LIST, {scopes: scopes}));
    }

    get(name, {scopes=this._scopes}={}) {
      return Promise.resolve()
      .then(() => this._messageCenter.sendRequest(ModuleConstants.REQUEST.GET, {scopes: scopes}, name));
    }

    load(mods, {scopes=this._scopes}={}) {
      return Promise.resolve()
      .then(() => this._messageCenter.sendRequest(ModuleConstants.REQUEST.LOAD, {scopes: scopes}, mods));
    }

    unload(mods, {scopes=this._scopes}={}) {
      return Promise.resolve()
      .then(() => this._messageCenter.sendRequest(ModuleConstants.REQUEST.UNLOAD, {scopes: scopes}, mods));
    }

    baseUpgrade(name, version, {scopes=this._scopes}={}) {
      return Promise.resolve()
      .then(() => this._messageCenter.sendRequest(ModuleConstants.REQUEST.BASE_UPGRADE, {scopes: scopes}, name, version));
    }

    delete(name, version, {scopes=this._scopes}={}) {
      return Promise.resolve()
      .then(() => this._messageCenter.sendRequest(ModuleConstants.REQUEST.DELETE, {scopes: scopes}, name, version));
    }

    getDataDirectory(name, {scopes=this._scopes}={}) {
      return Promise.resolve()
      .then(() => this._messageCenter.sendRequest(ModuleConstants.REQUEST.GET_DATA_DIRECTORY, {scopes: scopes}, name));
    }

    addListListener(listener, {scopes=this._scopes}={}) {
      return this._messageCenter.addEventListener(ModuleConstants.EVENT.LIST, scopes, listener);
    }

    removeListListener(listener) {
      return this._messageCenter.removeEventListener(ModuleConstants.EVENT.LIST, listener);
    }

    addManagerStateChangedListener(listener, {scopes=this._scopes}={}) {
      return this._messageCenter.addEventListener(ModuleConstants.EVENT.MANAGER_STATE_CHANGED, scopes, listener);
    }

    removeManagerStateChangedListener(listener) {
      return this._messageCenter.removeEventListener(ModuleConstants.EVENT.MANAGER_STATE_CHANGED, listener);
    }
  }

  module.exports = ModuleApi;
})();
