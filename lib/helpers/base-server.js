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

  const WEB_SERVER_PORT_START = 13370;

  const url = require('url');
  const http = require('http');
  const express = require('express');
  const passport = require('passport');
  const helmet = require('helmet');
  const compression = require('compression');
  const bodyParser = require('body-parser');
  const httpProxy = require('http-proxy');
  const morgan = require('morgan');
  const multer = require('multer');
  const cluster = require('cluster');
  const ProxyApi = require('./../proxy/proxy-api');

  class BaseServer {
    constructor({logging=false, parseBody=true}={}) {
      if (cluster.isMaster) {
        throw new Error('BaseServer[helper] may only be created on a worker.');
      }
      this._workerId = cluster.worker.id;
      this._app = express();
      this._app.set('trust proxy', 'loopback');
      this._app.use(helmet());
      if (logging) {
        this._app.use(morgan('dev'));
      }
      this._app.use(compression());
      if (parseBody) {
        this._app.use(bodyParser.json());
        this._app.use(bodyParser.urlencoded({extended: false}));
      }
      this._proxyDatas = [];
      this._messageCenter = null;
      this._server = null;
      this._host = null;
      this._proxyApi = null;
    }

    load(messageCenter, port) {
      return Promise.resolve()
      .then(() => {
        this._messageCenter = messageCenter;
        this._proxyApi = new ProxyApi(messageCenter);
      })
      .then(() => this._listen(port))
      .then(() => {
        // TODO: Change to use IPv6?
        this._host = url.format({
          protocol: 'http:',
          slashes: true,
          hostname: '127.0.0.1',
          port: this._server.address().port
        });
        this._serving = true;
      })
      .then(() => {
        return this._proxyDatas.reduce((chain, data) => {
          return chain
          .then(() => this._proxyApi.add({
            workerId: this._workerId,
            path: data.path,
            host: this._host,
            isAuthenticated: data.isAuthenticated
          }))
          .then((id) => {
            data.id = id;
          });
        }, Promise.resolve());
      });
    }

    unload() {
      return Promise.resolve()
      .then(() => {
        this._serving = false;
        this._host = null;
      })
      .then(() => {
        return this._proxyDatas
        .filter((data) => (null !== data.id))
        .reduce((chain, data) => {
          return chain
          .then(() => this._proxyApi.remove({id: data.id}))
          .then(() => {
            data.id = null;
          });
        }, Promise.resolve());
      })
      .then(() => this._close())
      .then(() => {
        this._server = null;
        this._messageCenter = null;
      });
    }

    _createWorkerPort() {
      const port = WEB_SERVER_PORT_START + this._workerId;
      return Promise.resolve(port);
    }

    _listen(manualPort) {
      return Promise.resolve()
      .then(() => this._createWorkerPort())
      .then((port) => {
        return new Promise((resolve, reject) => {
          this._server = http.createServer(this._app);
          this._server.on('error', reject);
          if (manualPort) {
            this._server.listen(manualPort, resolve);
          } else {
            this._server.listen(port, resolve);
          }
        });
      });
    }

    _close() {
      return Promise.resolve()
      .then(() => {
        return new Promise((resolve, reject) => {
          this._server.on('error', reject);
          this._server.close(resolve);
        });
      });
    }

    use(path, middleware, {isAuthenticated=true}={}) {
      return Promise.resolve()
      .then(() => {
        if ('function' === typeof(path)) {
          middleware = path;
          path = '/';
        }
      })
      .then(() => {
        if (middleware) {
          this._app.use(path, middleware);
        }
      })
      .then(() => {
        const data = {
          id: null,
          path: path,
          middleware: middleware,
          isAuthenticated: isAuthenticated
        };
        this._proxyDatas.push(data);
        if (this._serving) {
          return Promise.resolve()
          .then(() => this._proxyApi.add({
            workerId: this._workerId,
            path: data.path,
            host: this._host,
            isAuthenticated: isAuthenticated
          }))
          .then((id) => {
            data.id = id;
          });
        }
      });
    }

    removeMiddleware(path, middleware) {
      return Promise.resolve()
      .then(() => {
        if ('function' === typeof(path)) {
          middleware = path;
          path = '/';
        }
        const data = this._proxyDatas.find((data) => (data.path === path && data.middleware === middleware));
        if (data) {
          const index = this._proxyDatas.indexOf(data);
          this._proxyDatas.splice(index, 1);
          if (this._serving) {
            return Promise.resolve()
            .then(() => this._proxyApi.remove({id: data.id}))
            .then(() => {
              data.id = null;
            });
          }
        } else {
          logger.warn(`Unable to find middleware for route ${path}.`);
        }
      })
      .then(() => {
        try {
          if (middleware) {
            return this._app.removeMiddleware(path, middleware);
          }
          return null;
        } catch (e) {
          console.log('TODO: Find a way to unload routes form an express app.');
          return Promise.reject(e);
        }
      });
    }


    getServer() {
      return this._server;
    }

    static get express() {
      return express;
    }

    static get passport() {
      return passport;
    }

    static get morgan() {
      return morgan;
    }

    static get multer() {
      return multer;
    }

    static get httpProxy() {
      return httpProxy;
    }

    static get bodyParser() {
      return bodyParser;
    }
  }

  module.exports = BaseServer;
})();
