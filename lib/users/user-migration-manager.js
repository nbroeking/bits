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

  const ScopesManager = require('../scopes/scopes-manager');

  const KEY_FLAGS = '/settings/flags';
  const SCOPES = ['account'];

  class UserMigrationManager {
    constructor(userManager, database) {
      this._userManager = userManager;
      this._database = database;
    }

    addFlaggedScopes() {
      return Promise.resolve()
      .then(() => this._getFlags())
      .then((flags) => this._filterUnflaggedScopeNames(flags))
      .then((scopeList) => {
        if (scopeList.length === 0) return Promise.resolve();
        return Promise.resolve()
        .then(() => this._addFlaggedScopesToAllUsers(scopeList))
        .then(() => this._setFlags(scopeList));
      });
    }

    _getFlags() {
      return this._database.get(KEY_FLAGS)
      .catch((err) => {
        if (err.notFound) return {};
        return Promise.reject(err);
      });
    }

    _setFlags(scopeList) {
      return Promise.resolve()
      .then(() => this._getFlags())
      .then((flags) => scopeList.reduce((obj, scope) => Object.assign(obj, {[scope]: 1}), flags))
      .then((flags) => this._database.put(KEY_FLAGS, flags));
    }

    _filterUnflaggedScopeNames(flags) {
      return Promise.resolve()
      .then(() => SCOPES.filter((scope) => !flags.hasOwnProperty(scope)));
    }

    _addFlaggedScopesToAllUsers(scopes) {
      return Promise.resolve()
      .then(() => this._userManager.list({}))
      .then((users) => Promise.all(users.map((user) => this._giveUserScopes(user, scopes))));
    }

    _giveUserScopes(user, scopes) {
      return Promise.resolve()
      .then(() => {
        const allStaticScopes = ScopesManager.STATIC_SCOPES;

        if (!Array.isArray(user.scopes)) {
          user.scopes = [];
        }

        const scopeLength = user.scopes.length;
        scopes.forEach((scopeName) => {
          if (allStaticScopes.hasOwnProperty(scopeName) && !user.scopes.find((scope) => scope.name === scopeName)) {
            user.scopes.push(allStaticScopes[scopeName]);
          }
        });

        if (user.scopes.length === scopeLength) return Promise.resolve();
        return this.update(user.id, {$set: {scopes: user.scopes}});
      });
    }
  }

  module.exports = UserMigrationManager;
})();
