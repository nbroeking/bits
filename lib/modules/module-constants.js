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

  const MODULE_PREFIX = 'base#Modules ';
  const MODULE = {
    REQUEST: {
      LIST: MODULE_PREFIX + 'list',
      GET: MODULE_PREFIX + 'get',
      LOAD: MODULE_PREFIX + 'load',
      UNLOAD: MODULE_PREFIX + 'unload',
      BASE_UPGRADE: MODULE_PREFIX + 'baseUpgrade',
      DELETE: MODULE_PREFIX + 'delete',
      GET_DATA_DIRECTORY: MODULE_PREFIX + 'getDataDirectory',
      GET_MANAGER_STATE: MODULE_PREFIX + 'getManagerState',
      GET_CURRENT_MODULE: MODULE_PREFIX + 'getCurrentModule',
      GET_MODULE_STATUS: MODULE_PREFIX + 'getModuleStatus'
    },
    EVENT: {
      LIST: MODULE_PREFIX + 'list',
      MANAGER_STATE_CHANGED: MODULE_PREFIX + 'manager-state-changed',
      CURRENT_MODULE_CHANGED: MODULE_PREFIX + 'current-module-changed',
      MODULE_STATUS_CHANGED: MODULE_PREFIX + 'module-status-changed',
      UPGRADE_STARTING: MODULE_PREFIX + 'upgrade-starting'
    }
  };

  module.exports = MODULE;
})();
