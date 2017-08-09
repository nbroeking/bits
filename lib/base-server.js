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

  const HTTP_PORT = process.env.HTTP_PORT || 80;
  const HTTPS_PORT = process.env.HTTPS_PORT || 443;

  const os = require('os');
  const path = require('path');
  const http = require('http');
  const https = require('https');
  const express = require('express');
  const helmet = require('helmet');
  const compression = require('compression');
  const UtilFs = require('./helpers/fs');
  const UtilPem = require('./utils/util-pem');
  const historyApiFallback = require('./ui/history-api-fallback');
  const passport = require('passport');
  const morgan = require('morgan');
  const BearerStrategy = require('passport-http-bearer');
  const SERVER_KEY_SIZE = 4096;

  const LoggerFactory = require('./logging/logger-factory');
  const logger = LoggerFactory.getLogger();

  // Backup files
  const BackUpCrt = path.join(global.paths.data, '/base', '/certs', 'device-server.crt');
  const BackUpKey = path.join(global.paths.data, '/base', '/keys', 'device.pem');


  class BaseServer {
    constructor(authManager, keyManager, certManager) {
      this.authManager = authManager;
      this._keyManager = keyManager;
      this._certManager = certManager;
      this.server = null;
      this._middlewares = {};

      this.strategy = new BearerStrategy(this._validateToken.bind(this));
      passport.use(this.strategy);

      this.app = express();
      this.app.use(helmet());
      // this.app.use(morgan('dev'));
      this.app.use(compression());
      this.app.use(passport.initialize());
      this.app.use(express.static('app'));
      this.app.use(historyApiFallback({index: path.join(__dirname, '/../app/index.html')}));
    }

    getPassport() {
      return passport;
    }

    _validateToken(token, done) {
      this.authManager.validateAccessToken(token)
      .then((accessToken) => {
        if (accessToken) {
          done(null, accessToken.user, {scope: 'all'});
        } else {
          done(null, false, {message: 'auth/invalid-token'});
        }
      })
      .catch((err) => done(null, false, {message: err.message}));
    }

    _getServerKey(keyManager) {
      return Promise.resolve()
      .then(() => keyManager.getDevicePrivateKey())
      .then((key) => key.getFilepath())
      .then((filename) => UtilFs.readFile(filename, 'utf8'))
      .catch((err) => {
        return UtilPem.createPrivateKey(SERVER_KEY_SIZE)
        .then((key) => {
          return UtilFs.writeFile(BackUpKey, key, 'utf8')
          .then(() => key);
        })
        .then((key) => {
          this._keyManager.reloadKeys();
          return key;
        });
      });
    }

    _getServerCertificate(certManager, key) {
      return Promise.resolve()
      .then(() => certManager.getDeviceServerCert())
      .then((cert) => cert.getFilepath())
      .then((filename) => UtilFs.readFile(filename, 'utf8'))
      .catch((err) => {
        const altNames = [];
        const ifaces = os.networkInterfaces();
        Object.keys(ifaces).forEach((ifacename) => {
          const ifaceInfos = ifaces[ifacename];
          ifaceInfos.forEach((info) => altNames.push(info.address));
        });

        const options = {
          clientKey: key,
          altNames: altNames,
          selfSigned: true,
          days: 999,
        };

        return UtilPem.createCertificate(options)
        .then((certificate) => {
          return UtilFs.writeFile(BackUpCrt, certificate, 'utf8')
          .then(() => certificate);
        })
        .then((certificate) => {
          certManager.reloadCerts();
          return certificate;
        });
      });
    }

    _getServerOptions(keyManager, certManager) {
      const options = {};
      return this._getServerKey(keyManager)
      .then((key) => {
        options.key = key;
        return this._getServerCertificate(certManager, key);
      })
      .then((cert) => {
        options.cert = cert;
        return options;
      });
    }

    listen() {
      logger.debug('Web Server Listen');
      return Promise.resolve()
      .then(() => this._createHttpServer())
      .then((server) => this._getServerOptions(this._keyManager, this._certManager))
      .then((options) => this._createServer(options));
    }

    _createServer(options) {
      return new Promise((fulfill, reject) => {
        // Create and start the server
        this.server = https.createServer(options, this.app);
        this.server.once('error', reject);
        this.server.listen(HTTPS_PORT, () => fulfill(this.server));
      });
    }

    _createHttpServer() {
      return new Promise((resolve, reject) => {
        const app = express();
        app.use(helmet());
        app.use(function(req, res) {
          res.redirect('https://' + req.hostname + ':' + HTTPS_PORT);
        });

        const server = http.createServer(app);
        server.once('error', reject);
        server.listen(HTTP_PORT, resolve);
      });
    }

    use(path, middleware) {
      return Promise.resolve()
      .then(() => {
        if (typeof (path) === 'function') {
          return this.use('/', path);
        }
        if (!(path in this._middlewares)) {
          this._middlewares[path] = [];
          if (path === '/') {
            this.app.use(this._getMiddleware(path));
          } else {
            this.app.use(path, this._getMiddleware(path));
          }
        }
        this._middlewares[path].push(middleware);
        return this._middlewares;
      });
    }

    removeMiddleware(path, middleware) {
      if (typeof (path) === 'function') {
        return this.removeMiddleware('/', path);
      }
      if (!Array.isArray(this._middlewares[path])) {
        return Promise.reject(new Error('No middleware for path ' + path + '.'));
      }
      const index = this._middlewares[path].indexOf(middleware);
      if (index < 0) {
        return Promise.reject(new Error('No middleware for path ' + path + '.'));
      }
      this._middlewares[path].splice(index, 1);
      return Promise.resolve(this._middlewares);
    }

    _getMiddleware(path) {
      if (path === undefined) {
        return this._getMiddleware('/');
      }
      if (!(path in this._middlewares)) {
        return Promise.reject(function(req, res, next) {});
      }

      return function(req, res, next) {
        this._walkSubstack(this._middlewares[path], req, res, next);
      }.bind(this);
    }

    _walkSubstack(stack, req, res, next) {
      if (typeof (stack) === 'function') {
        stack = [stack];
      }

      const walkStack = function(i, err) {
        if (err) {
          return next(err);
        }

        if (i >= stack.length) {
          return next();
        }

        stack[i](req, res, walkStack.bind(null, i + 1));
      };

      walkStack(0);
    }

    static get morgan() {
      return morgan;
    }
  }

  module.exports = BaseServer;
})();
