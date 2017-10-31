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

  const url = require('url');
  const ProxyMessenger = require('./proxy-messenger');
  const httpProxy = require('http-proxy');
  const logger = require('../logging/logger-factory').getLogger();
  const passport = require('passport');

  class ProxyManager {
    constructor(baseServer, moduleManager) {
      this._baseServer = baseServer;
      this._moduleManager = moduleManager;
      this._messenger = new ProxyMessenger(this);
      this._id = 0;
      this._proxies = [];
      this._boundDied = this._onDied.bind(this);
    }

    _onDied(workerId) {
      const workerProxies = this._proxies.filter((proxyData) => workerId === proxyData.workerId);
      workerProxies.reduce((chain, proxyData) => chain.then(() => this.removeProxy(proxyData.id)), Promise.resolve())
      .catch((err) => logger.error(`Failed to remove proxies for worker that died: ${err.message}.`));
    }

    load(messageCenter) {
      return Promise.resolve()
      .then(() => this._messenger.load(messageCenter));
    }

    unload() {
      return Promise.resolve()
      .then(() => this._messenger.unload());
    }

    _createId() {
      return Promise.resolve(this._id++);
    }

    addProxy({workerId, path, host, isAuthenticated=true}={}) {
      return Promise.resolve()
      .then(() => this._createId())
      .then((id) => {
        const target = url.parse(host);
        target.pathname = path;

        /* eslint-disable new-cap */
        const proxy = new httpProxy.createProxyServer({
          target: url.format(target),
          xfwd: true,
          ws: true
        });
        /* eslint-enable new-cap */

        proxy.on('error', (err, req, res) => {
          logger.error('Proxy failed.', {
            error: {
              name: err.name,
              message: err.message,
              stack: err.stack
            }
          });
          if (!res.headersSent) {
            res.writeHead(400, {'Content-Type': 'text/plain'});
          }
          res.end(err.message);
        });

        const proxyData = {
          workerId: workerId,
          id: id,
          path: path,
          middleware: (req, res) => {
            if ('object' === typeof(req.user) && null !== req.user) {
              const {id} = req.user;
              req.headers['x-forwarded-user-id'] = id;
            }
            proxy.web(req, res);
          }
        };

        if (isAuthenticated) {
          proxyData.auth = passport.authenticate('bearer', {session: false});
        } else {
          proxyData.auth = null;
        }

        this._proxies.push(proxyData);
        return Promise.resolve()
        .then(() => {
          if (null !== proxyData.auth) {
            return this._baseServer.use(proxyData.path, proxyData.auth);
          }
        })
        .then(() => this._baseServer.use(proxyData.path, proxyData.middleware))
        .then(() => id);
      });
    }

    removeProxy({id}={}) {
      return Promise.resolve()
      .then(() => {
        const proxyData = this._proxies.find((proxyData) => id === proxyData.id);
        if (proxyData) {
          const index = this._proxies.indexOf(proxyData);
          this._proxies.splice(index, 1);
          return Promise.resolve()
          .then(() => this._baseServer.removeMiddleware(proxyData.path, proxyData.middleware))
          .then(() => {
            if (null !== proxyData.auth) {
              this._baseServer.removeMiddleware(proxyData.path, proxyData.auth);
            }
          });
        } else {
          return Promise.reject(new Error('proxy/proxy-not-found'));
        }
      });
    }
  }

  module.exports = ProxyManager;
})();
