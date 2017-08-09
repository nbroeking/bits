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
  const http = require('http');
  const Server = require('socket.io');
  const LoggerFactory = require('./logging/logger-factory');
  const logger = LoggerFactory.getLogger();

  function calculateDuration(start) {
    const diff = process.hrtime(start);
    return (diff[0] * 1e9 + diff[1]) / 1e6;
  }

  class ClientManager {
    constructor(authManager, messageCenter) {
      this._authManager = authManager;
      this._messageCenter = messageCenter;
      this.io = null;
      this._socketInfos = {};
    }

    load(server) {
      this.io = new Server();
      const opts = {log: true, serveClient: false};
      this.io.attach(server, opts);

      const eio = this.io.eio;
      const origHandleRequest = eio.handleRequest;

      this.io.eio.handleRequest = (req, res) => {
        const params = url.parse(req.url, true);
        const accessToken = params.query.accessToken;
        this._authenticate(accessToken)
        .then((accessToken) => {
          req.accessToken = accessToken;
        })
        .then(() => origHandleRequest.apply(eio, [req, res]))
        .catch((err) => {
          logger.error('Websocket request failed authentication.', {
            error: {
              name: err.name,
              message: err.message,
              stack: err.stack
            }
          });
          res.writeHead(404);
          res.end(http.STATUS_CODES[404]);
        });
      };

      this.io.on('connection', this._onConnect.bind(this));

      return Promise.resolve();
    }

    _authenticate(token) {
      return Promise.resolve()
      .then(() => {
        if (token) {
          return this._authManager.validateAccessToken(token);
        } else {
          return Promise.reject('Invalid web socket connection: no access token');
        }
      });
    }

    _onConnect(socket) {
      const socketId = socket.id;
      logger.silly('Socket connected', {socketId: socketId});

      this._socketInfos[socketId] = {
        events: {},
        requests: {},
        requestId: 0
      };

      socket.on('disconnect', () => this._handleSocketDisconnect(socket));
      socket.on('sendRequest', (...data) => this._handleSendRequest(socket, ...data));
      socket.on('addEventListener', (...data) => this._handleAddEventListener(socket, ...data));
      socket.on('removeEventListener', (...data) => this._handleRemoveEventListener(socket, ...data));
    }

    _handleSocketDisconnect(socket) {
      const socketId = socket.id;
      logger.silly('Socket disconnected', {socketId: socketId});
      const info = this._socketInfos[socketId];
      this._socketInfos[socketId] = null;

      Object.keys(info.events).forEach((event) => {
        const eventInfo = info.events[event];
        if (0 < eventInfo.count) {
          this._messageCenter.removeEventListener(event, eventInfo.listener);
        }
      });
    }

    _handleSendRequest(socket, meta, ...data) {
      const user = socket.request.accessToken.user;
      const event = meta.event;
      const requestId = meta.requestId;
      logger.silly(`Socket ${socket.id} sent '${event}' request.`, {
        socketId: socket.id,
        event: event,
        requestId: requestId,
        data: data
      });
      const start = process.hrtime();
      const responseMeta = {
        event: event,
        responseId: requestId,
        duration: 0
      };

      return this._messageCenter.sendRequest(event, {user: user, scopes: user.scopes.map((scope) => scope.name)}, ...data)
      .then((data) => {
        const duration = calculateDuration(start);
        responseMeta.duration = duration;
        socket.emit('response', responseMeta, null, data);
      })
      .catch((err) => {
        let error = err.error || err;
        logger.warn('There was an error making the request', error);
        const duration = calculateDuration(start);
        responseMeta.duration = duration;
        if (error instanceof Error) {
          error = {
            name: err.name,
            message: err.message
          };
        }
        if ('PERMISSIONS' === err.reason) {
          responseMeta.reason = err.reason;
          responseMeta.data = {
            handleText: err.handleText,
            text: err.error,
            event: err.event
          };
        }
        socket.emit('response', responseMeta, error, null);
      });
    }

    _handleAddEventListener(socket, meta) {
      const socketId = socket.id;
      const user = socket.request.accessToken.user;
      const event = meta.event;
      logger.silly(`Socket ${socket.id} added '${event}' event listener.`, {
        socketId: socketId,
        event: event
      });
      const info = this._socketInfos[socketId];
      let eventInfo = info.events[event];
      if (!eventInfo) {
        const eventMeta = {
          event: event
        };
        const onEvent = (...data) => {
          logger.silly(`Event ${event} triggered.`, {
            socketId: socketId,
            event: event,
            data: data
          });
          socket.emit('event', eventMeta, ...data);
        };
        eventInfo = {
          listener: onEvent,
          count: 0
        };
        info.events[event] = eventInfo;
      }
      if (0 === eventInfo.count) {
        this._messageCenter.addEventListener(event, {scopes: user.scopes.map((scope) => scope.name), user: user}, eventInfo.listener)
        .catch((err) => {
          logger.warn(`Socket ${socketId} failed to add '${event}' event listener.`, {
            socketId: socketId,
            event: event,
            error: {
              name: err.name,
              message: err.message
            }
          });
        });
      }
      eventInfo.count++;
      return Promise.resolve();
    }

    _handleRemoveEventListener(socket, meta) {
      const socketId = socket.id;
      const event = meta.event;
      logger.silly(`Socket ${socket.id} removed '${event}' event listener.`, {
        socketId: socketId,
        event: event
      });
      const info = this._socketInfos[socketId];
      const eventInfo = info.events[event];
      if (eventInfo) {
        if (0 < eventInfo.count) {
          eventInfo.count--;
          if (0 === eventInfo.count) {
            this._messageCenter.removeEventListener(event, eventInfo.listener)
            .catch((err) => {
              logger.warn(`Socket ${socketId} failed to remove '${event}' event listener.`, {
                socketId: socketId,
                event: event,
                error: {
                  name: err.name,
                  message: err.message
                }
              });
            });
          }
        } else {
          logger.warn(`Socket ${socketId} tried to remove '${event}' event listener that has not been added.`, {
            socketId: socketId,
            event: event
          });
        }
      } else {
        logger.warn(`Socket ${socketId} tried to remove '${event}' event listener that has never been added.`, {
          socketId: socketId,
          event: event
        });
      }
      return Promise.resolve();
    }
  }

  module.exports = ClientManager;
})();
