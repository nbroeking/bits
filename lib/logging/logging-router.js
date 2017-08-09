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

  const ROUTER_PATH = '/api/base/logging';

  const bodyParser = require('body-parser');
  const passport = require('passport');
  const express = require('express');
  const Router = express.Router;

  class LoggingRouter {
    constructor(manager) {
      this._manager = manager;
      this._baseServer = null;

      const router = new Router();
      router.use(bodyParser.urlencoded({extended: false}));
      router.use(bodyParser.json());
      router.use(passport.authenticate('bearer', {session: false}));
      router.get('/:id/export', this._export.bind(this));
      router.use(this._logErrors.bind(this));
      router.use(this._errorHandler.bind(this));
      this._router = router;
    }

    load(baseServer) {
      return Promise.resolve()
      .then(() => {
        this._baseServer = baseServer;
      })
      .then(() => this._baseServer.use(ROUTER_PATH, this._router));
    }

    unload() {
      return Promise.resolve()
      .then(() => this._baseServer.use(ROUTER_PATH, this._router))
      .then(() => {
        this._baseServer = null;
      });
    }

    _export(req, res, next) {
      Promise.resolve()
      .then(() => this._manager.get(Number(req.params.id)))
      .then((item) => {
        return new Promise(function(resolve, reject) {
          res.download(item.filepath, item.filename, (err) => {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          });
        });
      })
      .catch(next);
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

  module.exports = LoggingRouter;
})();
