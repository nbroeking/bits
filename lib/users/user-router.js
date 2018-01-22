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

  const ROUTER_PATH = '/api/base/users';

  const bodyParser = require('body-parser');
  const express = require('express');
  const passport = require('passport');
  const UserApi = require('./user-api');

  const Router = express.Router;

  class UsersRouter {
    constructor() {
      this._router = new Router();
      this._router.use(bodyParser.urlencoded({extended: false}));
      this._router.use(bodyParser.json());
      this._router.use(passport.authenticate('bearer', {session: false}));

      this._router.use(this._loadApi.bind(this));

      this._router.param('userId', this._loadUser.bind(this));

      this._router.get('/', this._list.bind(this));
      this._router.post('/', this._create.bind(this));
      this._router.get('/:userId', this._get.bind(this));
      this._router.post('/:userId', this._update.bind(this));
      this._router.put('/:userId', this._update.bind(this));
      this._router.delete('/:userId', this._delete.bind(this));

      this._messageCenter = null;
      this._baseServer = null;
    }

    load(messageCenter, baseServer) {
      return Promise.resolve()
      .then(() => {
        this._messageCenter = messageCenter;
        this._baseServer = baseServer;
      })
      .then(() => this._baseServer.use(ROUTER_PATH, this._router));
    }

    unload() {
      return Promise.resolve()
      .then(() => this._baseServer.removeMiddleware(ROUTER_PATH, this._router))
      .then(() => {
        this._messageCenter = messageCenter;
        this._baseServer = baseServer;
      });
    }

    _loadApi(req, res, next) {
      const {scopes} = req.user;
      req.api = new UserApi(this._messageCenter, {scopes: scopes.map(({name}) => name)});
      next();
    }

    _parseError(err) {
      let error = null;
      let statusCode = 500;
      if ('PERMISSIONS' === err.reason) {
        error = {code: 4401, message: err.error};
        statusCode = 401;
      } else if (err.notFound) {
        error = {code: 4404, message: err.message};
        statusCode = 404;
      } else {
        error = {code: 5500, message: err.message};
        statusCode = 500;
      }
      return {
        error: error,
        statusCode: statusCode,
      };
    }

    _loadUser(req, res, next, userId) {
      req.userParamId = Number.parseInt(userId);
      Promise.resolve()
      .then(() => req.api.get(req.userParamId))
      .then((user) => {
        if (!user) {
          const err = new Error('item-not-found');
          err.notFound = true;
          return Promise.reject(err);
        }
        req.userParam = user;
        next();
      })
      .catch((err) => {
        const response = {
          success: false,
          messages: [],
          errors: [],
          result: null,
        };
        const {error, statusCode} = this._parseError(err);
        response.errors.push(error);
        res.status(statusCode).json(response);
      });
    }

    _list(req, res) {
      const response = {
        success: false,
        messages: [],
        errors: [],
        result: null,
      };
      Promise.resolve()
      .then(() => req.api.list())
      .then((result) => {
        response.success = true;
        response.result = result;
        res.status(200);
      })
      .catch((err) => {
        const {error, statusCode} = this._parseError(err);
        response.errors.push(error);
        res.status(statusCode);
      })
      .then(() => res.json(response));
    }

    _create(req, res) {
      const response = {
        success: false,
        messages: [],
        errors: [],
        result: null,
      };
      Promise.resolve()
      .then(() => req.api.create(req.body))
      .then((result) => {
        response.success = true;
        response.result = result;
        res.status(200);
      })
      .catch((err) => {
        const {error, statusCode} = this._parseError(err);
        response.errors.push(error);
        res.status(statusCode);
      })
      .then(() => res.json(response));
    }

    _get(req, res) {
      const response = {
        success: true,
        messages: [],
        errors: [],
        result: req.userParam,
      };
      res.status(200).json(response);
    }

    _update(req, res) {
      const response = {
        success: false,
        messages: [],
        errors: [],
        result: null,
      };
      const {password, scopes} = req.body;
      const update = {
        $set: {
          password: password,
          scopes: scopes,
        },
      };
      Promise.resolve()
      .then(() => req.api.update(req.userParamId, update))
      .then((result) => {
        response.success = true;
        response.result = result;
        res.status(200);
      })
      .catch((err) => {
        const {error, statusCode} = this._parseError(err);
        response.errors.push(error);
        res.status(statusCode);
      })
      .then(() => res.json(response));
    }

    _delete(req, res) {
      const response = {
        success: false,
        messages: [],
        errors: [],
        result: null,
      };
      Promise.resolve()
      .then(() => req.api.delete(req.userParamId))
      .then((result) => {
        response.success = true;
        response.result = result;
        res.status(200);
      })
      .catch((err) => {
        const {error, statusCode} = this._parseError(err);
        response.errors.push(error);
        res.status(statusCode);
      })
      .then(() => res.json(response));
    }
  }

  module.exports = UsersRouter;
})();
