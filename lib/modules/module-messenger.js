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

  const SCOPES = ['base'];
  const PUBLIC_SCOPE = ['public'];

  const ModuleConstants = require('./module-constants');
  const Messenger = require('./../helpers/messenger');

  class ModuleMessenger extends Messenger {
    constructor(manager) {
      super();
      this._manager = manager;
      this.addRequestListener(ModuleConstants.REQUEST.LIST, SCOPES, this.requestList.bind(this));
      this.addRequestListener(ModuleConstants.REQUEST.GET, SCOPES, this.requestGetFromName.bind(this));
      this.addRequestListener(ModuleConstants.REQUEST.LOAD, SCOPES, this.installModules.bind(this));
      this.addRequestListener(ModuleConstants.REQUEST.UNLOAD, SCOPES, this.uninstallModules.bind(this));
      this.addRequestListener(ModuleConstants.REQUEST.BASE_UPGRADE, SCOPES, this.baseUpgrade.bind(this));
      this.addRequestListener(ModuleConstants.REQUEST.GET_DATA_DIRECTORY, null, this.getDataDir.bind(this));
      this.addRequestListener(ModuleConstants.REQUEST.DELETE, SCOPES, this.requestDeletePackage.bind(this));
      this.addRequestListener(ModuleConstants.REQUEST.GET_MODULE_STATUS, PUBLIC_SCOPE, this.getModuleStatus.bind(this));
      this.addRequestListener(ModuleConstants.REQUEST.GET_MANAGER_STATE, PUBLIC_SCOPE, this.getManagerState.bind(this));
      this.addRequestListener(ModuleConstants.REQUEST.GET_CURRENT_MODULE, PUBLIC_SCOPE, this.getCurrentModule.bind(this));

      this.addEmitterEventListener(this._manager, 'manager-state-changed', this._onManagerStateChanged.bind(this));
      this.addEmitterEventListener(this._manager, 'module-status-changed', this._onModuleStatusChanged.bind(this));
      this.addEmitterEventListener(this._manager, 'current-module-changed', this._onCurrentModuleChanged.bind(this));
    }

    getModuleStatus() {
      return this._manager.getModuleStatus();
    }

    getManagerState() {
      return this._manager.getManagerState();
    }

    getCurrentModule() {
      return this._manager.getCurrentModule();
    }

    _onManagerStateChanged(state) {
      return this.sendEvent(ModuleConstants.EVENT.MANAGER_STATE_CHANGED, {scopes: PUBLIC_SCOPE}, state);
    }

    _onModuleStatusChanged(status) {
      return this.sendEvent(ModuleConstants.EVENT.MODULE_STATUS_CHANGED, {scopes: PUBLIC_SCOPE}, status);
    }

    _onCurrentModuleChanged(mod) {
      return this.sendEvent(ModuleConstants.EVENT.CURRENT_MODULE_CHANGED, {scopes: PUBLIC_SCOPE}, mod);
    }

    requestList(metadata) {
      return this._manager.getModuleList();
    }

    baseUpgrade(metadata, name, version) {
      return Promise.resolve()
      .then(() => this._manager.getModuleFromName(name))
      .then((mod) => this._manager.installModule(mod, version));
    }

    installModules(metadata, modules) {
      return Promise.all(modules.map((mod) => {
        return this._manager.getModuleFromName(mod.name)
        .then((realmod) => {
          if (mod.version) {
            return this._manager.installModule(realmod, mod.version);
          } else {
            return Promise.resolve(realmod);
          }
        });
      }))
      .then((installedModules) => this._manager.loadModules(installedModules))
      .then(() => {
        return {success: true};
      });
    }

    uninstallModules(metadata, modInfo) {
      return this._manager.uninstallModulesByName(modInfo)
      .then((mod) => this._manager.filterModule(mod));
    }

    reportModules(moduleList) {
      // TODO: Convert this to listen for events on the manager.
      return this._messageCenter.sendEvent(ModuleConstants.EVENT.LIST, {scopes: SCOPES}, moduleList);
    }

    requestDeletePackage(metadata, name, version) {
      if (name && version) {
        return this._manager.remove(name, version)
        .then((mod) => this._manager.filterModule(mod));
      } else {
        return Promise.reject(new Error('Must specify a dmodule name and version'));
      }
    }

    requestGetFromName(metadata, name) {
      if (name) {
        return this._manager.getModuleFromName(name)
        .then((mod) => this._manager.filterModule(mod));
      } else {
        return Promise.reject(new Error('Must specify a module name'));
      }
    }

    getDataDir(metadata, name) {
      return this._manager.getDataDirectory(name);
    }
  }

  module.exports = ModuleMessenger;
})();
