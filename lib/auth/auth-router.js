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

  const ROUTE_PATH = '/api/base/auth';

  const express = require('express');
  const LoggerFactory = require('./../logging/logger-factory');

  const Router = express.Router;
  const logger = LoggerFactory.getLogger();
  const bodyParser = require('body-parser');

  class AuthRouter {
    constructor(manager) {
      this._manager = manager;
      this._router = new Router();
      this._router.use(bodyParser.urlencoded({extended: false}));
      this._router.use(bodyParser.json());

      this._router.route('/signin')
      .post(this._signIn.bind(this));

      this._router.route('/verify')
      .post(this._verify.bind(this));

      this._router.use(this._logErrors.bind(this));
      this._router.use(this._errorHandler.bind(this));
    }

    load(baseServer) {
      return Promise.resolve()
      .then(() => {
        this._baseServer = baseServer;
      })
      .then(() => this._baseServer.use(ROUTE_PATH, this._router));
    }

    unload() {
      return Promise.resolve()
      .then(() => this._baseServer.removeMiddleware(ROUTE_PATH, this._router))
      .then(() => {
        this._baseServer = null;
      });
    }

    _signIn(req, res, next) {
      Promise.resolve()
      .then(() => {
        const type = this._getLoginType(req);
        if ('anonymous' === type) {
          return this._manager.signInAnonymously();
        } else if ('username' === type) {
          const username = this._getUsername(req);
          const password = this._getPassword(req);
          return this._manager.signInWithUsernameAndPassword(username, password)
          .catch((err) => {
            if (err.code === 'locked') {
              return Promise.reject(new Error('auth/account-locked'));
            } else {
              return Promise.reject(new Error('auth/invalid-credentials'));
            }
          });
        } else {
          const err = new Error('auth/type-not-supported');
          err.name = 'AuthError';
          err.status = 400;
          return Promise.reject(err);
        }
      })
      .catch((err) => {
        err.status = 400;
        return Promise.reject(err);
      })
      .then((accessToken) => {
        res.status(200).json({
          token: accessToken.token,
          user: {
            username: accessToken.user.username,
            scopes: accessToken.user.scopes,
            createdAt: accessToken.user.createdAt,
            updatedAt: accessToken.user.updatedAt,
            isAnonymous: accessToken.user.isAnonymous
          }
        });
      })
      .catch(next);
    }

    _verify(req, res, next) {
      const token = this._getToken(req);
      this._manager.validateAccessToken(token)
      .catch((err) => {
        err.status = 400;
        return Promise.reject(err);
      })
      .then((accessToken) => {
        res.status(200).json({
          token: accessToken.token,
          user: {
            username: accessToken.user.username,
            scopes: accessToken.user.scopes,
            createdAt: accessToken.user.createdAt,
            updatedAt: accessToken.user.updatedAt,
            isAnonymous: accessToken.user.isAnonymous
          }
        });
      })
      .catch(next);
    }

    _getUser(req) {
      return this._getFromBodyThenQuery(req, 'user');
    }

    _getLoginType(req) {
      return this._getFromBodyThenQuery(req, 'type');
    }

    _getUsername(req) {
      return this._getFromBodyThenQuery(req, 'username');
    }

    _getPassword(req) {
      return this._getFromBodyThenQuery(req, 'password');
    }

    _getToken(req) {
      return this._getFromBodyThenQuery(req, 'token');
    }

    _getFromBodyThenQuery(req, propName) {
      const bodyKeys = Object.keys(req.body);
      const queryKeys = Object.keys(req.query);
      let prop = null;
      if (-1 !== bodyKeys.findIndex((k) => k === propName)) {
        prop = req.body[propName];
      } else if (-1 !== queryKeys.findIndex((k) => k === propName)) {
        prop = req.query[propName];
      }

      if (!propName) {
        prop = null;
      }

      return prop;
    }

    _logErrors(err, req, res, next) {
      logger.error('Router error occured! %s', err.message, {
        error: err.toString(),
        status: err.status || 500,
        name: err.name,
        message: err.message,
      });
      logger.error(err.stack);
      next(err);
    }

    _errorHandler(err, req, res, next) {
      if (Number.isInteger(err.status)) {
        res.status(err.status);
      } else {
        res.status(500);
      }
      res.json({error: {message: err.toString()}});
    }
  }

  module.exports = AuthRouter;
})();
