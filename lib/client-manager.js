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
      this._authManager.on('deleted', this._onAccessTokenDeleted.bind(this));
      this._messageCenter = messageCenter;
      this.io = null;
      this._socketInfos = new Map();
      this._authorizedSockets = new Map();
    }

    load(server) {
      const opts = {log: true, serveClient: false};
      this.io = new Server();
      this.io.use(this._onAuthorization.bind(this));
      this.io.on('connection', this._onConnect.bind(this));
      this.io.attach(server, opts);
      return Promise.resolve();
    }

    _onAuthorization(socket, next) {
      const socketId = socket.id;
      this._authorizedSockets.delete(socketId);
      Promise.resolve()
      .then(() => {
        const accessToken = socket.handshake.query.accessToken;
        return this._authManager.validateAccessToken(accessToken);
      })
      .then((authInfo) => this._authorizedSockets.set(socketId, authInfo))
      .catch(() => null)
      .then(() => next());
    }

    _onConnect(socket) {
      const socketId = socket.id;
      if (!this._authorizedSockets.has(socketId)) {
        logger.error('Socket not authenticated.', {socketId: socketId});
        socket.emit('auth', {type: 'unauthorized', reason: 'Token is invalid'});
        process.nextTick(() => socket.disconnect());
        return;
      }
      logger.silly('Socket connected', {socketId: socketId});
      const authInfo = this._authorizedSockets.get(socketId);
      const scopes = authInfo.user.scopes.map((scope) => scope.name);
      this._socketInfos.set(socketId, {
        events: new Map(),
        requestId: 0,
        socket: socket,
        authId: authInfo.id,
        user: authInfo.user,
        scopes: scopes
      });

      socket.on('disconnect', () => this._handleSocketDisconnect(socket));
      socket.on('sendRequest', (...data) => this._handleSendRequest(socket, ...data));
      socket.on('addEventListener', (...data) => this._handleAddEventListener(socket, ...data));
      socket.on('removeEventListener', (...data) => this._handleRemoveEventListener(socket, ...data));
    }

    _handleSocketDisconnect(socket) {
      const socketId = socket.id;
      logger.silly('Socket disconnected', {socketId: socketId});
      const info = this._socketInfos.get(socketId);
      this._socketInfos.delete(socketId);
      info.events.forEach((eventInfo, event) => {
        if (0 < eventInfo.count) {
          this._messageCenter.removeEventListener(event, eventInfo.listener);
        }
      });
    }

    _handleSendRequest(socket, meta, ...data) {
      const socketId = socket.id;
      const socketInfo = this._socketInfos.get(socketId);
      const user = socketInfo.user;
      const scopes = socketInfo.scopes;
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

      this._messageCenter.sendRequest(event, {user: user, scopes: scopes}, ...data)
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
      const socketInfo = this._socketInfos.get(socketId);
      const user = socketInfo.user;
      const scopes = socketInfo.scopes;
      const event = meta.event;
      logger.silly(`Socket ${socket.id} added '${event}' event listener.`, {
        socketId: socketId,
        event: event
      });
      if (!socketInfo.events.has(event)) {
        const onEvent = (...data) => {
          logger.silly(`Event ${event} triggered.`, {
            socketId: socketId,
            event: event,
            data: data
          });
          socket.emit('event', {event: event}, ...data);
        };
        socketInfo.events.set(event, {
          listener: onEvent,
          count: 0
        });
      }
      const eventInfo = socketInfo.events.get(event);
      if (0 === eventInfo.count) {
        this._messageCenter.addEventListener(event, {user: user, scopes: scopes}, eventInfo.listener)
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
    }

    _handleRemoveEventListener(socket, meta) {
      const socketId = socket.id;
      const event = meta.event;
      logger.silly(`Socket ${socket.id} removed '${event}' event listener.`, {
        socketId: socketId,
        event: event
      });
      const info = this._socketInfos.get(socketId);
      if (info.events.has(event)) {
        const eventInfo = info.events.get(event);
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
    }

    _onAccessTokenDeleted(accessToken) {
      const authId = accessToken.id;
      this._socketInfos.forEach((info) => {
        if (authId === info.authId) {
          const socket = info.socket;
          socket.emit('auth', {type: 'unauthorized', reason: 'Token was deleted'});
          process.nextTick(() => socket.disconnect());
        }
      });
    }
  }

  module.exports = ClientManager;
})();
