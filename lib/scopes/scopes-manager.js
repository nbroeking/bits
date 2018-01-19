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
  const ScopesMessenger = require('./scopes-messenger');

  const STATIC_SCOPES = Object.freeze({
    account: Object.freeze({
      name: 'account',
      displayName: 'Account Management'
    }),
    base: Object.freeze({
      name: 'base',
      displayName: 'Administrator'
    }),
    public: Object.freeze({
      name: 'public',
      displayName: 'Public'
    })
  });

  class ScopesManager extends EventEmitter {
    constructor() {
      super();
      this._scopes = {};
      this._scopesMessenger = new ScopesMessenger(this);
    }

    load(messageCenter) {
      return Promise.resolve()
      .then(() => Promise.all(Object.keys(STATIC_SCOPES).map((scopeName) => this.create(STATIC_SCOPES[scopeName]))))
      .then(() => this._scopesMessenger.load(messageCenter));
    }

    unload() {
      return Promise.resolve()
      .then(() => this._scopesMessenger.unload());
    }

    create(scope) {
      return Promise.resolve()
      .then(() => {
        if ('string' !== typeof(scope.name) || 0 >= scope.name.length) {
          return Promise.reject(new TypeError('scope/invalid-name'));
        } else if (this._scopes.hasOwnProperty(scope.name)) {
          return Promise.reject(new Error('scope/name-exists'));
        } else if ('string' !== typeof(scope.displayName) || 0 >= scope.displayName.length) {
          return Promise.reject(new TypeError('scope/invalid-displayName'));
        } else {
          this._scopes[scope.name] = scope;
          this.emit('created', [scope]);
          return Promise.resolve(scope);
        }
      });
    }

    list() {
      return Promise.resolve(Object.keys(this._scopes)
      .map((scopeKey) => this._scopes[scopeKey]));
    }

    get(name) {
      return Promise.resolve()
      .then(() => {
        let scope = this._scopes[name];
        if (!scope) {
          scope = null;
        }
        return scope;
      });
    }

    static get SCOPE_ACCOUNT() {
      return STATIC_SCOPES.account;
    }

    static get SCOPE_BASE() {
      return STATIC_SCOPES.base;
    }

    static get SCOPE_PUBLIC() {
      return STATIC_SCOPES.public;
    }

    static get STATIC_SCOPES() {
      return STATIC_SCOPES;
    }
  }

  module.exports = ScopesManager;
})();
