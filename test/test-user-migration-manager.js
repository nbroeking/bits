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

  const chai = require('chai');
  const chaiAsPromised = require('chai-as-promised');
  const expect = chai.expect;
  chai.use(chaiAsPromised);

  const UserMigrationManager = require('../lib/users/user-migration-manager');

  class UserManager {
    constructor() {
      this._list = [{
        id: 0,
        scopes: [{name: 'account', displayName: 'account'}]
      }, {
        id: 1,
        scopes: []
      }];
    }

    list() {
      return Promise.resolve()
      .then(() => this._list);
    }

    update(id, update) {
      return Promise.resolve();
    }

    get(id) {
      return this._list.find((item) => item.id === id);
    }
  };

  class Database {
    constructor() {
      this._item = {};
    }

    get() {
      return Promise.resolve()
      .then(() => this._item);
    }

    put() {
      return Promise.resolve();
    }
  }

  describe('UserMigrationManager', () => {
    let userMigrationManager = null;
    let userManager = null;
    let database = null;

    beforeEach('Create UserManager', () => {
      userManager = new UserManager();
      database = new Database();
      userMigrationManager = new UserMigrationManager(userManager, database);
    });

    describe('addFlaggedScopes', () => {
      beforeEach('Create UserManager', () => {
        userManager = new UserManager();
        database = new Database();
        userMigrationManager = new UserMigrationManager(userManager, database);
      });

      it('should keep scopes length as 1 for id 0', () => {
        return userMigrationManager.addFlaggedScopes()
        .then(() => {
          const item = userManager.get(0);
          expect(item.scopes.length).to.equal(1);
        });
      });

      it('should keep scopes length as 0 for id 1', () => {
        return database.get()
        .then((flags) => Promise.resolve(flags.account = 1))
        .then(() => userMigrationManager.addFlaggedScopes())
        .then(() => {
          const item = userManager.get(1);
          expect(item.scopes.length).to.equal(0);
        });
      });

      it('should set scopes length to 1 for id 1', () => {
        return userMigrationManager.addFlaggedScopes()
        .then(() => {
          const item = userManager.get(1);
          expect(item.scopes.length).to.equal(1);
        });
      });

      it('should set scope item name to "account" for id 1', () => {
        return userMigrationManager.addFlaggedScopes()
        .then(() => {
          const item = userManager.get(1);
          expect(item.scopes[0].name).to.equal('account');
        });
      });
    });

    describe('_setFlags', () => {
      it('should set account flag to 1', () => {
        return userMigrationManager._setFlags(['account'])
        .then(() => database.get())
        .then((flags) => {
          expect(flags.account).to.equal(1);
        });
      });
    });
  });
})();
