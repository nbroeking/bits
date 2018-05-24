/**
Copyright 2018 LGS Innovations

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

  const EventEmitter = require('events');
  const ErrorLog = require('./error-logger');
  const logger = require('./simple-logger');
  const SocketIo = require('socket.io');

  const MIN_START = 0;
  const MAX_START = Number.MAX_SAFE_INTEGER;

  class MiniMessageCenter extends EventEmitter {
    constructor(proc) {
      logger.silly('[MMC] ctor');
      super();

      this.process = proc;
      this._io = null;
      this._eventEmitter = new EventEmitter();
      this._requestEmitter = new EventEmitter();
      this._responseEmitter = new EventEmitter();

      this._requestId = Math.floor(Math.random() * (MAX_START - MIN_START + 1)) + MIN_START;

      this._handlers = []; // For local events
      this._requests = []; // For local requests
      this._eventSubscriberhandlers = [];

      this._allEvents = [];
      this._allRequests = [];
      this._socketInfos = new Map();

      // initialize socket.io connection
      this._io = new SocketIo();
      this._io.on('connection', this._onConnect.bind(this));
    }

    connect(server) {
      this._io.attach(server, {log: true, serveClient: false});
    }

    _onConnect(socket) {
      logger.silly('[MMC] _onConnect(' + socket.id + ')');
      // create an info structure to manage data for this socket
      this._socketInfos.set(socket.id, {
        events: new Map(),
        requestId: 0,
        socket: socket,
      });

      socket.on('disconnect', () => this._handleSocketDisconnect(socket));
      socket.on('sendRequest', (...data) => this._handleSendRequest(socket, ...data));
      socket.on('addEventListener', (...data) => this._handleAddEventListener(socket, ...data));
      socket.on('removeEventListener', (...data) => this._handleRemoveEventListener(socket, ...data));
    }

    _handleSocketDisconnect(socket) {
      logger.silly('[MMC] _handleSocketDisconnect(' + socket.id + ')');
      // get the info structure for this socket
      const socketInfo = this._socketInfos.get(socket.id);
      // remove the data structure from _socketInfos
      this._socketInfos.delete(socket.id);
      // and remove each event listener
      socketInfo.events.forEach((eventInfo, event) => {
        if (0 < eventInfo.count) {
          this.removeEventListener(event, eventInfo.listener);
        }
      });
    }

    _handleSendRequest(socket, meta, ...data) {
      logger.silly('[MMC] _handleSendRequest(' + socket.id + ', ' + meta.requestId + ':' + meta.event + ')');

      const event = meta.event;
      const requestId = meta.requestId;

      const responseMeta = {
        event: event,
        responseId: requestId,
        duration: 0
      };

      this.sendRequest(event, ...data)
      .then((data) => {
        socket.emit('response', responseMeta, null, data);
      })
      .catch((err) => {
        let error = err.error || err;
        logger.debug('There was an error in sendRequest(' + event + '): ' + error);
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
        logger.silly('ClientManager::_handleSendRequest(' + event + '), responseMeta: ' + responseMeta);
        socket.emit('response', responseMeta, error, null);
      });
    }

    _handleAddEventListener(socket, meta) {
      logger.silly('[MMC] _handleAddEventListener(' + socket.id + ', ' + meta.event + ')');

      const socketId = socket.id;
      const socketInfo = this._socketInfos.get(socketId);
      const event = meta.event;

      if (!socketInfo.events.has(event)) {
        const onEvent = (...data) => {
          logger.debug(`Event ${event} triggered.`, {
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
        this.addEventListener(event, eventInfo.listener)
        .catch((err) => {
          logger.error('Socket ' + socketId + ' failed to add ' + event + ' event listener: ' + err);
          return ErrorLog.append('MMC._handleAddEventListener(' + event + '): ' + err);
        });
      }
      eventInfo.count++;
    }

    _isValidEvent(event) {
      return 'string' === typeof(event) && 0 < event.length;
    }

    _isValidListener(listener) {
      return 'function' === typeof(listener);
    }

    _sendRequest(event, requestId, ...data) {
      logger.silly('[MMC] _sendRequest(' + event + ', ' + requestId + ', ' + data + ')');
      const exists = this._allRequests.some((element) => {
        return element === event;
      });
      if (exists) {
        logger.silly('[MMC] _sendRequest: EMIT ' + event);
        this._requestEmitter.emit(event, requestId, ...data);
      } else {
        logger.silly('[MMC] _sendRequest: no subscribers for ' + event);
        return this._sendResponse(event, requestId, `No listeners subscribed to ${event}`, null);
      }
      return Promise.resolve();
    }

    _sendResponse(event, responseId, err, result) {
      logger.silly('[MMC] _sendResponse(' + event + ', ' + responseId + ', ' + err + ', ' + result + ')');
      this._responseEmitter.emit(event, responseId, err, result);
      return Promise.resolve();
    }

    sendEvent(event, metadata, ...data) {
      logger.silly('[MMC] sendEvent(' + event + ', ' + data + ')');
      if (!metadata) {
        metadata = {};
      }

      if (!this._isValidEvent(event)) {
        logger.debug('[MMC] sendEvent: ERROR: event must be a non-empty string.');
        return ErrorLog.append('MMC.sendEvent(' + event + '): ' + 'Tried to send an invalid event')
        .then(() => Promise.reject(new TypeError('event must be a non-empty string.')));
      }
      this._eventEmitter.emit(event, metadata, ...data);
      return Promise.resolve();
    }

    sendRequest(event, metadata, ...data) {
      logger.silly('[MMC] sendRequest(' + event + ', ' + metadata + ', ' + data + ')');
      if (!metadata) {
        metadata = {};
      }

      if (!this._isValidEvent(event)) {
        logger.error('[MMC] sendRequest: ERROR: event must be a non-empty string.');
        return ErrorLog.append('MMC.sendRequest(' + event + '): ' + 'Tried to send an invalid event')
        .then(() => Promise.reject(new TypeError('event must be a non-empty string.')));
      }
      return new Promise((resolve, reject) => {
        this._requestId++;
        if (this._requestId >= (Number.MAX_SAFE_INTEGER - 1)) {
          this._requestId = 0;
        }
        const requestId = (this._requestId).toString();
        const handleRequest = (responseId, err, result) => {
          logger.silly('[MMC] handleRequest(' + responseId + ', ' + err + ', ' + result + ')');
          if (responseId === requestId) {
            this._removeResponseEventListener(event, handleRequest);
            if (err) {
              reject(err);
            } else {
              resolve(result);
            }
          }
        };
        this._addResponseEventListener(event, handleRequest);
        this._sendRequest(event, requestId, metadata, ...data);
      });
    }

    addEventListener(event, listener) {
      logger.silly('[MMC] addEventListener)' + event + ')');

      if (!this._isValidEvent(event)) {
        logger.error('[MMC] addEventListener: ERROR: event must be a non-empty String');
        return ErrorLog.append('MMC.addEventListener(' + event + '): ' + 'Tried to add a listener for an invalid event')
        .then(() => Promise.reject(new TypeError('event must be a non-empty String.')));
      } else if (!this._isValidListener(listener)) {
        logger.error('[MMC] addEventListener: ERROR: listener must be a function.');
        return ErrorLog.append('MMC.addEventListener(' + event + '): ' + 'Tried to add an invalid listener')
        .then(() => Promise.reject(new TypeError('listener must be a function.')));
      }

      // Fill in the metadata
      const metadata = {};
      metadata.event = event;

      const eventHandle = {};
      eventHandle.event = event;
      eventHandle.metadata = metadata;
      eventHandle.originalListener = listener;
      eventHandle.listener = (metadata, ...data) => {
        return eventHandle.originalListener(...data);
      };
      this._handlers.push(eventHandle);
      this._addEventListener(event, eventHandle.listener);
      return Promise.resolve();
    }

    removeEventListener(event, listener) {
      logger.silly('[MMC] removeEventListener(' + event + ')');
      if (!this._isValidEvent(event)) {
        logger.error('[MMC] removeEventListener: ERROR: event must be a non-empty string.');
        return ErrorLog.append('MMC.removeEventListener(' + event + '): ' + 'Tried to remove an invalid event')
        .then(() => Promise.reject(new TypeError('event must be a non-empty string.')));
      } else if (!this._isValidListener(listener)) {
        logger.error('[MMC] removeEventListener: ERROR: listener must be a function.');
        return ErrorLog.append('MMC.removeEventListener(' + event + '): ' + 'Tried to remove an invalid listener')
        .then(() => Promise.reject(new TypeError('listener must be a function.')));
      }
      const size = this._handlers.length;
      this._handlers = this._handlers.filter((eventHandle) => {
        if ((event === eventHandle.event && eventHandle.originalListener === listener)) {
          this._removeEventListener(eventHandle.event, eventHandle.listener);
          return false;
        } else {
          return true;
        }
      });

      if (size === this._handlers.length) {
        logger.error('[MMC] removeEventListener: ERROR: Unable to remove event listener because it does not exist ' + event);
        return ErrorLog.append('MMC.removeEventListener(' + event + '): ' + 'Listener does not exist')
        .then(() => Promise.reject(new Error('Unable to remove event listener because it does not exist ' + event)));
      }
      return Promise.resolve();
    }

    addRequestListener(event, metadata, listener) {
      logger.silly('[MMC] addRequestListener(' + event + ')');

      if (!this._isValidEvent(event)) {
        logger.error('[MMC] addRequestListener: ERROR: event must be a non-empty string.');
        return ErrorLog.append('MMC.addRequestListener(' + event + '): ' + 'Tried to add an invalid event')
        .then(() => Promise.reject(new TypeError('event must be a non-empty string.')));
      } else if (!this._isValidListener(listener)) {
        logger.error('[MMC] addRequestListener: ERROR: listener must be a function.');
        return ErrorLog.append('MMC.addRequestListener(' + event + '): ' + 'Tried to add an invalid listener')
        .then(() => Promise.reject(new TypeError('listener must be a function.')));
      }

      const request = {};
      request.event = event;
      request.originalListener = listener;
      request.listener = (requestId, metadata, ...data) => {
        if ('string' !== typeof(requestId) || 0 >= requestId.length) {
          logger.error('[MMC] Request listener must be called with a requestId...bad developer!: ', event, requestId, data);
          return ErrorLog.append('MMC.addRequestListener(' + event + '): ' + 'Tried to add an invalid request');
        }
        // Provide the requestId in case the handler wants it
        metadata.requestId = requestId;

        return Promise.resolve()
        .then(() => listener(metadata, ...data))
        .then((result) => this._sendResponse(event, requestId, null, result))
        .catch((err) => {
          return ErrorLog.append('MMC.addRequestListener(' + event + '): ' + err)
          .then(() => {
            let errorObj = null;
            if (err instanceof Error) {
              errorObj = {
                message: err.message,
                stack: err.stack,
                name: err.name
              };
            } else if (err) {
              errorObj = err;
            } else {
              errorObj = {
                message: 'Unknown Error',
                name: 'Unknown Error'
              };
            }
            this._sendResponse(event, requestId, errorObj, null);
          });
        });
      };
      this._addRequestEventListener(event, request.listener);

      this._requests.push(request);

      return Promise.resolve();
    }

    _addEventListener(event, listener) {
      logger.silly('[MMC] _addEventListener(' + event + ')');
      // add event to eventEmitter and allEvents list
      this._eventEmitter.on(event, listener);
      this._allEvents.push(event);

      return Promise.resolve();
    }

    _removeEventListener(event, listener) {
      logger.silly('[MMC] _removeEventListener(' + event + ')');
      this._eventEmitter.removeListener(event, listener);
      this._allEvents = this._allEvents.filter((e) => {
        return e !== event;
      });

      return Promise.resolve();
    }

    _addRequestEventListener(event, listener) {
      logger.silly('[MMC] _addRequestEventListener(' + event + ')');
      this._requestEmitter.on(event, listener);
      this._allRequests.push(event);

      return Promise.resolve();
    }

    _addResponseEventListener(event, listener) {
      logger.silly('[MMC] _addResponseEventListener(' + event + ')');
      this._responseEmitter.on(event, listener);
      return Promise.resolve();
    }

    _removeResponseEventListener(event, listener) {
      logger.silly('[MMC] _removeResponseEventListener(' + event + ')');
      this._responseEmitter.removeListener(event, listener);
      return Promise.resolve();
    }

    __dump(name, obj) {
      const keys = [];
      for (let key in obj) {
        if (obj.hasOwnProperty(key)) {
          keys.push(key);
        }
      }
      const sortedKeys = keys.sort();
      for (let i = 0; i < sortedKeys.length; i++) {
        const key = sortedKeys[i];
        const type = typeof(obj[key]);
        let baseString = '  ' + name + '[' + key + ']: ' + type;
        if (type === 'number') {
          baseString += ' (' + obj[key] + ')';
        }
        logger.debug(baseString);
      }
    }

    __dumpEE(name, emitter) {
      if (emitter.eventNames().length > 0) {
        const title = '-'.repeat(10) + ' ' + name + ' ' + '-'.repeat(80);
        logger.debug(title.slice(0, 80));
        this.__dump(name, emitter);
        logger.debug('  EventNames: ' + emitter.eventNames());
        logger.debug('-'.repeat(80));
      }
    }
  }

  module.exports = MiniMessageCenter;
})();
