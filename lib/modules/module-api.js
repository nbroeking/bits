/**
Copyright 2018 LGS Innovations

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
  const CrudApi = require('../helpers/crud-api');
  const TAG = 'base#ModuleManager';

  class ModuleApi extends CrudApi {
    constructor(messageCenter, {scopes=SCOPES}={}) {
      super(TAG, messageCenter, {scopes=CrudApi.DEFAULT_SCOPES}={});
      this._messageCenter = messageCenter;
      this._scopes = scopes;
    }

    baseUpgrade(name, version, {scopes=this._scopes}={}) {
      return Promise.resolve()
      .then(() => this._messageCenter.sendRequest(ModuleConstants.REQUEST.BASE_UPGRADE, {scopes: scopes}, name, version));
    }

    getDataDirectory(name, {scopes=this._scopes}={}) {
      return Promise.resolve()
      .then(() => this._messageCenter.sendRequest(ModuleConstants.REQUEST.GET_DATA_DIRECTORY, {scopes: scopes}, name));
    }

    addModulesLoadedListener(listener) {
      return this._messageCenter.addEventListener(ModuleConstants.EVENT.LOADED, {scopes: this._scopes}, listener);
    }

    removeModulesLoadedListener(listener) {
      return this._messageCenter.removeEventListener(ModuleConstants.EVENT.LOADED, {scopes: this._scopes}, listener);
    }
  }

  module.exports = ModuleApi;
})();
