(() => {
  'use strict';

  const AuthApi = require('../auth/auth-api');
  const express = require('express');
  const logger = global.LoggerFactory.getLogger();
  const Router = express.Router;
  const UserApi = require('../users/user-api');

  class CrudRouter {
    constructor(manager, {readScopes=null, writeScopes=null, routePath}) {
      this._manager = manager;

      this._readScopes = readScopes;
      this._writeScopes = writeScopes;
      this._routePath = routePath;

      this._router = new Router();
      this._router.post('/create', this._create.bind(this));
      this._router.post('/update', this._update.bind(this));
      this._router.post('/delete', this._delete.bind(this));
      this._router.get('/:id', this._getOrCount.bind(this));
      this._router.get('/', this._list.bind(this));
    }

    _prepareResult({result, messages=[], errors=[]}={}) {
      return Promise.resolve({
        success: (result ? true : false),
        messages: messages,
        errors: errors,
        result: result
      });
    }

    _create(req, res, next) {
      Promise.resolve()
      .then(() => this.__getAccessToken(req))
      .then((token) => this.__checkPermissions(token.user, 'write'))
      .then(() => {
        const items = this.__fromBody(req, 'items');
        return this._manager.create(items);
      })
      .then((results) => this._prepareResult({result: results}))
      .then((result) => res.status(200).json(result))
      .catch(next);
    }

    _update(req, res, next) {
      Promise.resolve()
      .then(() => this.__getAccessToken(req))
      .then((token) => this.__checkPermissions(token.user, 'write'))
      .then(() => {
        const ids = this.__fromBody(req, 'ids');
        const update = this.__fromBody(req, 'update');
        return this._manager.update(ids, update);
      })
      .then((results) => this._prepareResult({result: results}))
      .then((result) => res.status(200).json(result))
      .catch(next);
    }

    _delete(req, res, next) {
      Promise.resolve()
      .then(() => this.__getAccessToken(req))
      .then((token) => this.__checkPermissions(token.user, 'write'))
      .then(() => {
        const ids = this.__fromBody(req, 'ids');
        return this._manager.delete(ids);
      })
      .then((results) => this._prepareResult({result: results}))
      .then((result) => res.status(200).json(result))
      .catch(next);
    }

    _getOrCount(req, res, next) {
      Promise.resolve()
      .then(() => {
        const id = req.params.id;
        if ('count' === id) {
          return this._count(req, res, next);
        } else if (NaN !== parseInt(id)) {
          return this._get(req, res, next);
        } else {
          return Promise.reject(new Error('invalid request'));
        }
      })
      .catch(next);
    }

    _get(req, res, next) {
      Promise.resolve()
      .then(() => this.__getAccessToken(req))
      .then((token) => this.__checkPermissions(token.user, 'read'))
      .then(() => {
        if (!req.params) {
          return Promise.reject(new Error('invalid request'));
        }
        const id = Number(req.params.id);
        return this._manager.get(id);
      })
      .then((results) => this._prepareResult({result: results}))
      .then((result) => res.status(200).json(result))
      .catch(next);
    }

    _list(req, res, next) {
      Promise.resolve()
      .then(() => this.__getAccessToken(req))
      .then((token) => this.__checkPermissions(token.user, 'read'))
      .then(() => {
        const query = (req.params && req.params.query ? req.params.query : {});
        const options = (req.params && req.params.options ? req.params.options : {});
        return this._manager.list(query, options);
      })
      .then((results) => this._prepareResult({result: results}))
      .then((result) => res.status(200).json(result))
      .catch(next);
    }

    _count(req, res, next) {
      Promise.resolve()
      .then(() => this.__getAccessToken(req))
      .then((token) => this.__checkPermissions(token.user, 'read'))
      .then(() => {
        const query = (req.params && req.params.query ? req.params.query : {});
        return this._manager.count(query);
      })
      .then((count) => this._prepareResult({result: count}))
      .then((result) => res.status(200).json(result))
      .catch(next);
    }

    load(messageCenter, baseServer) {
      this._baseServer = baseServer;
      this._authApi = new AuthApi(messageCenter);
      this._userApi = new UserApi(messageCenter);

      return Promise.resolve()
      .then(() => {
        // Add here so the class can be extended/routes added before error handlers
        this._router.use(this._logErrors.bind(this));
        this._router.use(this._errorHandler.bind(this));
      })
      .then(() => this._baseServer.use(this._routePath, this._router));
    }

    unload() {
      return Promise.resolve()
      .then(() => this._baseServer.removeMiddleware(this._routePath, this._router))
      .then(() => {
        this._authApi = null;
        this._baseServer = null;
        this._routePath = null;
        this._router = null;
      });
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
      let status = 500;
      if (Number.isInteger(err.status)) {
        res.status(err.status);
        status = err.status;
      } else {
        res.status(500);
      }
      this._prepareResult({errors: [{code: status, message: err.message}]})
      .then((result) => res.json(result));
    }

    __fromBody(req, key) {
      if (!req.body.hasOwnProperty(key)) {
        return Promise.reject(new Error('invalid request'));
      }
      return req.body[key];
    }

    __checkPermissions(user, accessType) {
      return Promise.resolve()
      .then(() => {
        const userScopes = user.scopes.map((scope) => scope.name);
        const scopes = this[`_${accessType}Scopes`];

        if (undefined === scopes) {
          return Promise.reject(new Error('invalid access-type'));
        }
        return scopes.every((scope) => userScopes.includes(scope));
      })
      .then((allowed) => {
        if (!allowed) {
          return Promise.reject(new Error('auth/unauthorized'));
        }
      });
    }

    __getAccessToken(req) {
      return Promise.resolve()
      .then(() => { // Pulled from passport-http-bearer
        if (req.headers && req.headers.authorization) {
          const parts = req.headers.authorization.split(' ');
          if (2 === parts.length) {
            const scheme = parts[0];
            if (/^Bearer$/i.test(scheme)) {
              return parts[1]; // credentials
            }
          }
        } else if (req.body && req.body.access_token) {
          return req.body.access_token;
        } else if (req.params && req.params.access_token) {
          return req.params.access_token;
        }
      })
      .then((token) => {
        if (!token) {
          return Promise.reject(new Error('auth/invalid-token'));
        }
        return this._authApi.validateAccessToken({token: token});
      });
    }
  }

  module.exports = CrudRouter;
})();
