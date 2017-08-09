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
  const HELPER = require('./helper-constants');
  const Messenger = require('./../helpers/messenger');

  class HelperMessenger extends Messenger {
    constructor(manager) {
      super();
      this._manager = manager;
      this.addRequestListener(HELPER.REQUEST.LIST, SCOPES, this._list.bind(this));
      this.addRequestListener(HELPER.REQUEST.ADD, SCOPES, this._add.bind(this));
      this.addEmitterEventListener(this._manager, 'added', this._added.bind(this));
    }

    _list() {
      return this._manager.list();
    }

    _add(metadata, helper) {
      return this._manager.add(helper);
    }

    _added(helper) {
      this.sendEvent(HELPER.EVENT.ADDED, {scopes: SCOPES}, helper);
    }
  }

  module.exports = HelperMessenger;
})();
