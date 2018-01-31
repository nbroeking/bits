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

  const CrudMessenger = require('../helpers/crud-messenger');
  const UserApi = require('./user-api');

  class UserMessenger extends CrudMessenger {
    constructor(manager) {
      super(UserApi.TAG, manager, {
        readScopes: ['public', 'account'],
        writeScopes: ['base', 'account']
      }, {filter: true});
    }

    sanitize(item) {
      return Promise.resolve()
      .then(() => {
        if (item) {
          return {
            id: item.id,
            username: item.username,
            scopes: item.scopes,
            isAnonymous: item.isAnonymous,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt
          };
        } else {
          return null;
        }
      });
    }

    _list(metadata) {
      return Promise.resolve()
      .then(() => this._manager.list(metadata))
      .then((items) => {
        if (metadata && Array.isArray(metadata.scopes)) {
          return Promise.all(items.map((item) => this.sanitize(item)));
        }
        return items;
      });
    }

    filterCreated(user, item) {
      return Promise.resolve()
      .then(() => this._manager.updateFilter(user, item));
    }

    filterUpdated(user, item) {
      return Promise.resolve()
      .then(() => this._manager.updateFilter(user, item));
    }

    filterDeleted(user, item) {
      return Promise.resolve()
      .then(() => this._manager.updateFilter(user, item));
    }
  }

  module.exports = UserMessenger;
})();
