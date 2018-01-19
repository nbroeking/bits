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

  const KEY_USER_ID = '/settings/userId';

  const EventEmitter = require('events');
  const UsersMessenger = require('./user-messenger');
  const UserMigrationManager = require('./user-migration-manager');
  const UserRouter = require('./users-router');
  const UtilFs = require('../helpers/fs');
  const UtilCrypto = require('../utils/crypto');
  const crypto = require('crypto');
  const path = require('path');
  const LevelDB = require('../utils/leveldb');
  const ScopesManager = require('./../scopes/scopes-manager');
  const ScopesUtil = require('./../scopes/scopes-util');
  const ADMIN_SCOPE = 'base';

  class UserManager extends EventEmitter {
    constructor(scopeManager) {
      super();
      this._storeBase= path.join(global.paths.data, 'base');
      this._storePath = path.join(this._storeBase, 'store');

      this._db = null;
      this._userIdChain = Promise.resolve();

      this._messenger = new UsersMessenger(this);
      this._router = new UserRouter();

      this._scopeManager = scopeManager;
    }

    load(messageCenter, baseServer) {
      return Promise.resolve()
      .then(() => this._setUpPath())
      .then(() => this._initDb())
      .then(() => {
        const userMigrationManager = new UserMigrationManager(this, this._db);
        return userMigrationManager.addFlaggedScopes();
      })
      .then(() => this._messenger.load(messageCenter))
      .then(() => this._router.load(messageCenter, baseServer));
    }

    _initDb() {
      return Promise.resolve()
      .then(() => {
        const dbpath = path.join(this._storePath, 'users');
        const options = {valueEncoding: 'json'};
        this._db = new LevelDB(dbpath, options);
      });
    }

    _setUpPath() {
      return Promise.resolve()
      .then(() => UtilFs.ensureDirectoryExists(this._storeBase))
      .then(() => UtilFs.ensureDirectoryExists(this._storePath));
    }

    _isValidId(id) {
      return 'number' === typeof (id);
    }

    _isValidUsername(username) {
      return 'string' === typeof (username);
    }

    _isValidPassword(password) {
      return 'string' === typeof (password) && 6 < password.length;
    }

    _isValidScopes(scopes) {
      // if (!Array.isArray(scopes)) {
      //   return false;
      // }
      // function isNonEmptyString(str) {
      //   return 'string' === typeof(str) && 0 < str.length;
      // }
      // if (scopes.some(({name}) => !isNonEmptyString(name))) {
      //   return false;
      // }
      // return true;
      return ScopesUtil.isValidScopes(scopes);
    }

    _createUserId() {
      this._userIdChain = this._userIdChain
      .then(() => this._db.get(KEY_USER_ID))
      .catch((err) => {
        if (err.notFound) {
          return 1;
        } else {
          throw err;
        }
      })
      .then((userId) => {
        return this._db.put(KEY_USER_ID, userId + 1)
        .then(() => userId);
      });
      return this._userIdChain;
    }

    create({username, password, scopes=null, isAnonymous=false, salt=this._createPasswordSalt(), hash=null}={}) {
      if (!this._isValidUsername(username)) {
        return Promise.reject(new TypeError('user/invalid-username'));
      } else if (!this._isValidPassword(password)) {
        return Promise.reject(new TypeError('user/weak-password'));
      } else {
        return this.getByUsername(username)
        .catch(() => null)
        .then((user) => {
          if (user) {
            return Promise.reject(new Error('user/username-already-in-use'));
          }
        })
        .then(() => {
          if (!this._isValidScopes(scopes)) {
            scopes = [];
          }
          if (!scopes.some((scope) => ScopesManager.SCOPE_PUBLIC.name === scope.name)) {
            scopes.push(ScopesManager.SCOPE_PUBLIC);
          }
        })
        .then(() => this._createUserId())
        .then((userId) => {
          const passwordHash = hash || this._createPasswordHash(password, salt);
          const now = Date.now();

          if (isAnonymous !== true) {
            isAnonymous = false;
          }

          const user = {
            id: userId,
            username: username,
            salt: salt,
            passwordHash: passwordHash,
            scopes: scopes,
            isAnonymous: isAnonymous,
            createdAt: now,
            updatedAt: now
          };

          return this._db.put(`/docs/${user.id}`, user)
          .then(() => {
            this.emit('created', [user]);
            return user;
          });
        });
      }
    }

    list(metadata, options) {
      return new Promise((resolve, reject) => {
        const users = [];
        const options = {
          gte: '/docs/',
          lte: '/docs/\xff'
        };
        this._db.createReadStream(options)
        .on('data', (data) => users.push(data.value))
        .on('error', reject)
        .on('close', () => resolve(users));
      })
      .then((users) => {
        if (metadata && metadata.user && !metadata.user.scopes.find((scope) => scope.name === ADMIN_SCOPE)) {
          const result = users.find((user) => {
            return user.id === metadata.user.id;
          });
          return [result];
        } else {
          return users;
        }
      });
    }

    updateFilter(user, item) {
      if (user.scopes.find((scope) => scope.name === ADMIN_SCOPE)) {
        return Promise.resolve(item);
      } else {
        if (user.id === item.id) {
          return Promise.resolve(item);
        } else {
          const error = new Error('filter/failed');
          error.reason = 'failed';
          return Promise.reject(error);
        }
      }
    }

    get(id) {
      if (!this._isValidId(id)) {
        return Promise.reject(new Error('user/invalid-id'));
      } else {
        return this._db.get(`/docs/${id}`)
        .catch((err) => {
          if (err.notFound) {
            return null;
          } else {
            throw err;
          }
        });
      }
    }

    getByUsername(username) {
      if (!this._isValidUsername(username)) {
        return Promise.reject(new TypeError('user/invalid-username'));
      } else {
        return this.list()
        .then((users) => {
          const user = users.find((user) => username === user.username);
          if (user) {
            return user;
          } else {
            return null;
          }
        });
      }
    }

    _isValidUpdate(update) {
      return 'object' === typeof(update) && null !== update;
    }

    update(id, update) {
      if (!this._isValidId(id)) {
        return Promise.reject(new TypeError('user/invalid-id'));
      } else if (!this._isValidUpdate(update)) {
        return Promise.reject(new TypeError('user/invalid-update'));
      } else {
        return this.get(id)
        .then((user) => {
          if (user) {
            let isDirty = false;
            if ('object' === typeof(update.$set) && null !== update.$set) {
              if (this._isValidPassword(update.$set.password)) {
                const password = update.$set.password;
                const salt = this._createPasswordSalt();
                const passwordHash = this._createPasswordHash(password, salt);
                user.salt = salt;
                user.passwordHash = passwordHash;
                isDirty = true;
              }
              if (this._isValidScopes(update.$set.scopes)) {
                const scopes = update.$set.scopes;
                if (!scopes.some((scope) => ScopesManager.SCOPE_PUBLIC.name === scope.name)) {
                  scopes.push(ScopesManager.SCOPE_PUBLIC);
                }
                user.scopes = scopes;
                isDirty = true;
              }
            }
            if (isDirty) {
              user.updatedAt = Date.now();
              return this._db.put(`/docs/${user.id}`, user)
              .then(() => {
                this.emit('updated', [user]);
                return user;
              });
            } else {
              return user;
            }
          } else {
            return null;
          }
        });
      }
    }

    delete(id) {
      if (!this._isValidId(id)) {
        return Promise.reject(new TypeError('user/invalid-id'));
      } else {
        return this.get(id)
        .then((user) => {
          if (null !== user) {
            return this._db.del(`/docs/${user.id}`)
            .then(() => {
              this.emit('deleted', [user]);
              return user;
            });
          }
        });
      }
    }

    authenicate(username, password) {
      return this.getByUsername(username)
      .then((user) => {
        if (null === user) {
          return Promise.reject(new Error('user/user-not-found'));
        } else {
          const hash = this._createPasswordHash(password, user.salt);
          if (hash === user.passwordHash) {
            return user;
          } else {
            return Promise.reject(new Error('auth/wrong-password'));
          }
        }
      });
    }

    _createPasswordHash(password, salt) {
      const shasum = crypto.createHash('sha256');
      shasum.update(password + salt, 'utf8');
      return shasum.digest('hex');
    }

    _createPasswordSalt() {
      return crypto.randomBytes(16).toString('hex');
    }

    _createAnonymousUser() {
      const user = {};
      return this._scopeManager.list()
      .then((scopes) => {
        user.scopes = scopes;
        return UtilCrypto.randomBytes(16);
      })
      .then((buf) => {
        const username = buf.toString('base64');
        user.username = username;
        return UtilCrypto.randomBytes(16);
      })
      .then((buf) => {
        const password = buf.toString('base64');
        user.password = password;
        return this.create({
          username: user.username,
          password: user.password,
          scopes: user.scopes,
          isAnonymous: true
        });
      });
    }

    getAnonymousUser() {
      return this.list()
      .then((users) => {
        const anonymousUsers = users.filter((user) => user.isAnonymous);
        if (0 < anonymousUsers.length) {
          return anonymousUsers[0];
        } else {
          return this._createAnonymousUser();
        }
      });
    }
  }

  module.exports = UserManager;
})();
