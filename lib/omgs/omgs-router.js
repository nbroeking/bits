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

  const ROUTER_PATH = '/api/base/omgs';

  const OmgsApi = require('./omgs-api');
  const passport = require('passport');
  const multer = require('multer');
  const express = require('express');
  const OmgsMessenger = require('./omgs-messenger');
  const LoggerFactory = require('./../logging/logger-factory');

  const Router = express.Router;
  const logger = LoggerFactory.getLogger();
  const bodyParser = require('body-parser');


  class OmgsRouter {
    constructor(manager) {
      const uploadDirectory = manager.getUploadDirectory();
      const storage = multer.diskStorage({
        destination: (req, file, done) => {
          done(null, uploadDirectory);
        }
      });
      const upload = multer({storage: storage});

      this._router = new Router();
      this._router.use(bodyParser.urlencoded({extended: false}));
      this._router.use(bodyParser.json());

      this._router.use(passport.authenticate('bearer', {session: false}));
      this._router.route('/')
      .get(this._list.bind(this))
      .post(upload.single('file'), this._create.bind(this));

      this._router.use(this._logErrors.bind(this));
      this._router.use(this._errorHandler.bind(this));

      this._baseServer = null;
      this._omgsApi = null;
    }

    load(baseServer, messageCenter) {
      return Promise.resolve()
      .then(() => {
        this._omgsApi = new OmgsApi(messageCenter);
        this._baseServer = baseServer;
        this._baseServer.use(ROUTER_PATH, this._router);
      });
    }

    unload() {
      return Promise.resolve()
      .then(() => {
        this._baseServer.removeMiddleware(ROUTER_PATH, this._router);
        this._baseServer = null;
        this._omgsApi = null;
      });
    }

    _getUserScopes(user) {
      return user.scopes.map((scope) => scope.name);
    }

    _list(req, res, next) {
      this._omgsApi.list({scopes: this._getUserScopes(req.user)})
      .then((omgs) => res.status(200).json(omgs))
      .catch(next);
    }

    _create(req, res, next) {
      Promise.resolve()
      .then(() => {
        const name = req.file.originalname;
        const filepath = req.file.path;
        return this._omgsApi.add({name: name, filepath: filepath}, {scopes: this._getUserScopes(req.user)});
      })
      .then((omg) => res.status(200).json(OmgsMessenger.sanitizeOmg(omg)))
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

  module.exports = OmgsRouter;
})();
