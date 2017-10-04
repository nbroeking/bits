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

  const KEY_ID = '/settings/id';

  const ACCESS_TOKEN_LENGTH = 256;

  const MAX_LOGIN_ATTEMPTS = 3;
  const TIMEOUT_DURATION = 20000;
  const FLUSH_TIMEOUT = 40000;

  const path = require('path');
  const AuthMessenger = require('./auth-messenger');
  const AuthRouter = require('./auth-router');
  const UtilCrypto = require('../utils/crypto');
  const UtilFs = require('../helpers/fs');
  const LevelDB = require('../utils/leveldb');
  const EventEmitter = require('events');
  const logger = require('../logging/logger-factory').getLogger();

  class AuthManager extends EventEmitter {
    constructor(userManager) {
      super();

      this._userManager = userManager;
      this._messenger = new AuthMessenger(this);

      this._db = null;
      this._router = new AuthRouter(this);

      if (global.paths && global.paths.data) {
        this._storeBase = path.join(global.paths.data, '/base/store');
      } else {
        this._storeBase = path.join('/tmp', '/data/base/store');
      }
      this._storePath = path.join(this._storeBase, '/auth');
      this._idChain = Promise.resolve();

      this._loginCheck = {};

      this._userManager.on('deleted', this._onUserDeleted.bind(this));
    }

    _createId() {
      this._idChain = this._idChain
      .then(() => this._db.get(KEY_ID))
      .catch((err) => {
        if (err.notFound) {
          return 1;
        } else {
          throw err;
        }
      })
      .then((userId) => {
        return this._db.put(KEY_ID, userId + 1)
        .then(() => userId);
      });
      return this._idChain;
    }

    _setUpPath() {
      return UtilFs.mkdir(this._storeBase).catch((err) => {}) // Mkdir if not exists
      .then(() => UtilFs.mkdir(this._storePath)).catch((err) => {}); // Mkdir if not exists
    }

    load(baseServer, messageCenter) {
      return Promise.resolve()
      .then(() => this._setUpPath())
      .then(() => {
        const options = {valueEncoding: 'json'};
        this._db = new LevelDB(this._storePath, options);
      })
      .then(() => this._messenger.load(messageCenter))
      .then(() => this._router.load(baseServer));
    }

    unload() {
      return Promise.resolve()
      .then(() => this._router.unload())
      .then(() => this._messenger.unload())
      .then(() => this._db.close())
      .then(() => {
        this._db = null;
      });
    }

    signInAnonymously() {
      return this._hasNonAnonymousUsers()
      .then((hasNonAnonymousUsers) => {
        if (hasNonAnonymousUsers) {
          return Promise.reject(new Error('auth/operation-not-allowed'));
        }
      })
      .then(() => this._userManager.getAnonymousUser())
      .then((user) => this._getAccessTokenForUser(user));
    }

    _hasNonAnonymousUsers() {
      return this._userManager.list()
      .then((users) => {
        const nonAnonymousUsers = users.filter((user) => !user.isAnonymous);
        return 0 < nonAnonymousUsers.length;
      });
    }

    _getAccessTokenById(accessTokenId) {
      return this._db.get(`/docs/${accessTokenId}`)
      .catch((err) => {
        if (err.notFound) {
          return null;
        } else {
          throw err;
        }
      });
    }

    _getAccessTokenByUserId(userId) {
      return this._db.get(`/indexes/userId/${userId}`)
      .then((accessTokenId) => this._getAccessTokenById(accessTokenId))
      .catch((err) => {
        if (err.notFound) {
          return null;
        } else {
          throw err;
        }
      });
    }

    _getAccessTokenByToken(token) {
      return this._db.get(`/indexes/token/${token}`)
      .then((accessTokenId) => this._getAccessTokenById(accessTokenId))
      .catch((err) => {
        if (err.notFound) {
          return null;
        } else {
          throw err;
        }
      });
    }

    _createAccessToken(user) {
      const now = Date.now();
      const accessToken = {
        userId: user.id,
        createdAt: now
      };
      return this._createId()
      .then((id) => {
        accessToken.id = id;
        return AuthManager.generateToken();
      })
      .then((token) => {
        accessToken.token = token;
        const ops = [
          {type: 'put', key: `/docs/${accessToken.id}`, value: accessToken},
          {type: 'put', key: `/indexes/token/${accessToken.token}`, value: accessToken.id},
          {type: 'put', key: `/indexes/userId/${accessToken.userId}`, value: accessToken.id}
        ];
        return this._db.batch(ops);
      })
      .then(() => accessToken);
    }

    revokeAccessTokenForUser(user) {
      return this._deleteAccessToken(user.accessToken);
    }

    _deleteAccessToken(accessToken) {
      return Promise.resolve()
      .then(() => {
        const ops = [
          {type: 'del', key: `/docs/${accessToken.id}`},
          {type: 'del', key: `/indexes/token/${accessToken.token}`},
          {type: 'del', key: `/indexes/userId/${accessToken.userId}`}
        ];
        return this._db.batch(ops);
      })
      .then(() => {
        this.emit('deleted', [accessToken]);
      });
    }

    getAccessTokenForUser(user) {
      return this._getAccessTokenForUser(user);
    }

    _getAccessTokenForUser(user) {
      return this._getAccessTokenByUserId(user.id)
      .then((accessToken) => {
        if (accessToken) {
          return accessToken;
        } else {
          return this._createAccessToken(user);
        }
      })
      .then((accessToken) => {
        accessToken.user = user;
        return accessToken;
      });
    }

    signInWithUsernameAndPassword(username, password) {
      // Initialize the data
      if (!this._loginCheck[username]) {
        this._loginCheck[username] = {};
        this._loginCheck[username].count = 0;
        this._loginCheck[username].timeout = null;
        this._loginCheck[username].flushtimeout = null;
        this._loginCheck[username].locked = false;
      }

      // Set the flush timeout
      clearTimeout(this._loginCheck[username].flushtimeout);
      this._loginCheck[username].flushtimeout = setTimeout(() => {
        if (this._loginCheck[username].timeout) {
          clearTimeout(this._loginCheck[username].timeout);
        }
        delete this._loginCheck[username];
      }, FLUSH_TIMEOUT);

      // If locked reject right away
      if (this._loginCheck[username].locked) {
        logger.debug('Login stopped because account locked for', username);
        this._setLockTimeout(username);
        return Promise.reject({code: 'locked'});
      }

      // Authenticate
      return Promise.resolve()
      .then(() => this._userManager.authenicate(username, password))
      .catch((err) => {
        logger.warn('Invalid login attempt for ', username);
        this._loginCheck[username]['count'] += 1;
        if (this._loginCheck[username]['count'] > MAX_LOGIN_ATTEMPTS) {
          logger.error('Too many login attempts for %s ... slowing down the login process', username);
          this._loginCheck[username].locked = true;
          this._setLockTimeout(username);
        }
        err.name = 'AuthError';
        return Promise.reject(err);
      })
      .then((user) => {
        this._loginCheck[username].count = 0;
        clearTimeout(this._loginCheck[username].timeout);
        this._loginCheck[username].timeout = null;
        this._loginCheck[username].locked = false;
        return this._getAccessTokenForUser(user);
      });
    }

    _setLockTimeout(username) {
      clearTimeout(this._loginCheck[username].timeout);
      this._loginCheck[username].timeout = setTimeout(() => {
        logger.debug('Unlocking account', username);
        this._loginCheck[username].locked = false;
        this._loginCheck[username].timeout = null;
      }, TIMEOUT_DURATION);
    }

    validateAccessToken(token) {
      return this._getAccessTokenByToken(token)
      .then((accessToken) => {
        if (accessToken) {
          return this._userManager.get(accessToken.userId)
          .then((user) => {
            if (user) {
              accessToken.user = user;
              return accessToken;
            } else {
              return Promise.reject(new Error('auth/invalid-user'));
            }
          });
        } else {
          return Promise.reject(new Error('auth/invalid-token'));
        }
      });
    }

    _onUserDeleted(user) {
      this._getAccessTokenByUserId(user.id)
      .then((accessToken) => {
        if (accessToken) {
          return this._deleteAccessToken(accessToken);
        }
      })
      .catch((err) => logger.warn('Failed to delete accessToken after user was deleted', {
        user: user,
        error: {
          name: err.name,
          message: err.message
        }
      }));
    }

    static generateToken() {
      return UtilCrypto.randomBytes(ACCESS_TOKEN_LENGTH)
      .then((buf) => buf.toString('hex'));
    }
  }

  module.exports = AuthManager;
})();
