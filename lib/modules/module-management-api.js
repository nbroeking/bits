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

  const LOAD_PROCESS_FINISH_EVENT = 'base#baseModuleFinishedLoad';

  class ModuleManagementApi {
    constructor(messageCenter, module, {scopes=SCOPES}={}) {
      this._messageCenter = messageCenter;
      this._scopes = scopes;
      this._module = module;
    }

    loadComplete({err, result} = {}, {scopes=this._scopes}={}) {
      return Promise.resolve()
      .then(() => this._messageCenter.sendEvent(LOAD_PROCESS_FINISH_EVENT, {scopes: scopes}, {err: err, result: result, module: this._getModule()}));
    }

    _getModule() {
      return {
        id: this._module.id,
        name: this._module.name,
        displayName: this._module.displayName,
        version: this._module.version
      };
    }
  }

  module.exports = ModuleManagementApi;
})();
