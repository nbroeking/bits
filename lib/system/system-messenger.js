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
  const ScopesManager = require('./../scopes/scopes-manager');
  const SCOPES_PUBLIC = [ScopesManager.SCOPE_PUBLIC.name];
  const SCOPES_BASE = [ScopesManager.SCOPE_BASE.name];

  const Constants = require('./system-constants');

  class SystemMessenger extends Messenger {
    constructor(manager) {
      super();
      this._manager = manager;
      this.addRequestListener(Constants.REQUEST.TIME_GET, SCOPES_PUBLIC, this._timeGet.bind(this));
      this.addRequestListener(Constants.REQUEST.TIME_SET, SCOPES_PUBLIC, this._timeSet.bind(this));
      this.addRequestListener(Constants.REQUEST.RESTART, SCOPES_BASE, this._restart.bind(this));
      this.addRequestListener(Constants.REQUEST.SHUTDOWN, SCOPES_BASE, this._shutdown.bind(this));
      this.addRequestListener(Constants.REQUEST.BITS_ID, SCOPES_BASE, this._bitsId.bind(this));
      this.addEmitterEventListener(this._manager, 'time', this._onTime.bind(this));
    }

    _timeGet() {
      return this._manager.getTime();
    }

    _timeSet(metadata, timeSetRequest) {
      return this._manager.setTime(timeSetRequest);
    }

    _restart() {
      return this._manager.restart();
    }

    _shutdown() {
      return this._manager.shutdown();
    }

    _bitsId() {
      return this._manager.getBitsId();
    }

    _onTime(timestamp) {
      this.sendEvent(SystemMessenger.EVENT.TIME, {scopes: SCOPES_PUBLIC}, timestamp);
    }

    static get REQUEST() {
      return Constants.REQUEST;
    }

    static get EVENT() {
      return Constants.EVENT;
    }

    static get TAG() {
      return Constants.TAG;
    }
  }

  module.exports = SystemMessenger;
})();
