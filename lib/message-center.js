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

  const EventEmitter = require('events');
  const logger = require('./logging/logger-factory').getLogger();

  const MIN_START = 0;
  const MAX_START = Number.MAX_SAFE_INTEGER;

  class MessageCenter extends EventEmitter {
    constructor(cluster, proc) {
      super();
      this.cluster = cluster;
      this.process = proc;
      this._eventEmitter = new EventEmitter();
      this._requestEmitter = new EventEmitter();
      this._responseEmitter = new EventEmitter();
      this._eventSubscriberEmitter = new EventEmitter();

      this._requestId = Math.floor(Math.random() * (MAX_START - MIN_START + 1)) + MIN_START;

      this._handlers = []; // For local events
      this._requests = []; // For local requests
      this._eventSubscriberhandlers = [];

      this._eventEntries = {}; // For ipc per worker
      this._requestEntries = {}; // For ipc per worker
      this._responseEntries = {}; // For ipc per worker
      this._eventSubscriberEntries = {};

      this._allEvents = [];
      this._allRequests = [];

      if (this.cluster.isMaster) {
        this.cluster.on('fork', this._masterInit.bind(this));
      } else if (this.cluster.isWorker) {
        this._eventEmitter.on('removeListener', this._deleteEventListener.bind(this));
        this._eventEmitter.on('newListener', this._newEventListener.bind(this));

        this._requestEmitter.on('removeListener', this._removeRequestListener.bind(this));
        this._requestEmitter.on('newListener', this._newRequestListener.bind(this));

        this._responseEmitter.on('removeListener', this._removeResponseListener.bind(this));
        this._responseEmitter.on('newListener', this._newResponseListener.bind(this));

        this._eventSubscriberEmitter.on('removeListener', this._removeEventSubscriberListener.bind(this));
        this._eventSubscriberEmitter.on('newListener', this._newEventSubscriberListener.bind(this));

        this.process.on('message', this._message.bind(this));
      } else {
        throw new TypeError('process is not a this.cluster master or worker');
      }
    }

    _masterInit(worker) {
      worker.on('message', (msg) => this._messageHandler(worker, msg));
    }

    cleanUpWorker(worker) {
      const workerId = worker.id;
      const eventEntry = this._eventEntries[workerId];
      const requestEntry = this._requestEntries[workerId];
      const responseEntry = this._responseEntries[workerId];
      const eventSubscriberEntry = this._eventSubscriberEntries[workerId];

      if (eventEntry) {
        Object.keys(eventEntry.events).forEach((event) => {
          return this._removeEventListener(event, eventEntry.events[event].listener, eventEntry.events[event].metadata);
        });
      }
      if (requestEntry) {
        Object.keys(requestEntry.events).forEach((event) => {
          return this._removeRequestEventListener(event, requestEntry.events[event].listener);
        });
      }
      if (responseEntry) {
        Object.keys(responseEntry.events).forEach((event) => {
          return this._removeResponseEventListener(event, responseEntry.events[event].listener);
        });
      }

      if (eventSubscriberEntry) {
        Object.keys(eventSubscriberEntry.events).forEach((event) => {
          return this._removeEventSubscriberListener(event, eventSubscriberEntry.events[events].listener);
        });
      }

      delete this._eventEntries[workerId];
      delete this._requestEntries[workerId];
      delete this._responseEntries[workerId];
      delete this._eventSubscriberEntries[workerId];
    }

    _messageHandler(worker, msg) {
      const type = msg.type;
      if ('event' === type) {
        return this._handleEvent(worker, msg);
      } else if ('request' === type) {
        return this._handleRequest(worker, msg);
      } else if ('response' === type) {
        return this._handleResponse(worker, msg);
      } else if ('addEventListener' === type) {
        return this._handleAddEvent(worker, msg);
      } else if ('removeEventListener' === type) {
        return this._handleRemoveEvent(worker, msg);
      } else if ('addRequestListener' === type) {
        return this._handleAddRequestListener(worker, msg);
      } else if ('removeRequestListener' === type) {
        return this._handleRemoveRequestListener(worker, msg);
      } else if ('addResponseListener' === type) {
        return this._handleAddResponseListener(worker, msg);
      } else if ('removeResponseListener' === type) {
        return this._handleRemoveResponseListener(worker, msg);
      } else if ('addEventSubscriberListener' === type) {
        return this._handleAddEventSubscriberListener(worker, msg);
      } else if ('removeEventSubscriberListener' === type) {
        return this._handleRemoveEventSubscriberListener(worker, msg);
      } else {
        logger.error('Unknown message type', type);
      }
    }

    _handleEvent(worker, msg) {
      const event = msg.event;
      const params = msg.params;

      this.sendEvent(event, ...params);
    }

    _handleRequest(worker, msg) {
      const event = msg.event;
      const id = msg.requestId;
      const data = msg.params;
      this._sendRequest(event, id, ...data);
    }

    _handleResponse(worker, msg) {
      const event = msg.event;
      const id = msg.responseId;
      const err = msg.err;
      const result = msg.result;

      this._sendResponse(event, id, err, result);
    }

    _handleAddEvent(worker, msg) {
      const event = msg.event;

      let entry = this._eventEntries[worker.id];

      // If there is no entry we need to create one for that particular worker
      if (!entry) {
        entry = {
          workerId: worker.id,
          events: {},
        };
        this._eventEntries[worker.id] = entry;
      }

      // If the worker has never requested the event creaate it
      let entryEvent = entry.events[event];
      if (!entryEvent) {
        entryEvent = {
          event: event,
          count: 0,
          metadata: msg.metadata,
          listener: (...data) => {
            worker.send({
              type: 'event',
              event: event,
              params: data
            });
          },
        };
        this._eventEntries[worker.id].events[event] = entryEvent;
        this._addEventListener(event, entryEvent.listener, msg.metadata);
      }
      this._eventEntries[worker.id].events[event].count++;
    }

    _handleRemoveEvent(worker, msg) {
      const event = msg.event;
      const entry = this._eventEntries[worker.id];
      if (entry) {
        const entryEvent = entry.events[event];
        if (entryEvent) {
          entryEvent.count--;
          if (entryEvent.count <= 0) {
            this._removeEventListener(event, entryEvent.listener, msg.metadata);
            delete entry.events[event];
          }
          if (entry.events.length <= 0) {
            delete this._eventEntries[worker.id];
          }
        } else {
          logger.error('Can not remove event for entry we know nothing about in the server for event', event);
        }
      } else {
        logger.error('Trying to remove a worker that does not exist', msg);
      }
    }

    _handleAddRequestListener(worker, msg) {
      const event = msg.event;

      let entry = this._requestEntries[worker.id];

      // If there is no entry we need to create one for that particular worker
      if (!entry) {
        entry = {
          workerId: worker.id,
          events: {},
        };
        this._requestEntries[worker.id] = entry;
      }

      // If the worker has never requested the event creaate it
      let entryEvent = entry.events[event];
      if (!entryEvent) {
        entryEvent = {
          event: event,
          count: 0,

          listener: (...data) => {
            worker.send({
              type: 'request',
              event: event,
              params: data
            });
          },
        };
        this._requestEntries[worker.id].events[event] = entryEvent;
        this._addRequestEventListener(event, entryEvent.listener);
      }
      this._requestEntries[worker.id].events[event].count++;
    }

    _handleRemoveRequestListener(worker, msg) {
      const event = msg.event;
      const entry = this._requestEntries[worker.id];
      if (entry) {
        const entryEvent = entry.events[event];
        if (entryEvent) {
          entryEvent.count--;
          if (entryEvent.count <= 0) {
            this._removeRequestEventListener(event, entryEvent.listener);
            delete entry.events[event];
          }
          if (entryEvent.length <= 0) {
            delete this._requestEntries[worker.id];
          }
        } else {
          logger.error('Can not remove request for entry we know nothing about', msg);
        }
      } else {
        logger.error('Trying to remove a worker that we dont know of', msg);
      }
    }

    _handleAddResponseListener(worker, msg) {
      const event = msg.event;

      let entry = this._responseEntries[worker.id];

      // If there is no entry we need to create one for that particular worker
      if (!entry) {
        entry = {
          workerId: worker.id,
          events: {},
        };
        this._responseEntries[worker.id] = entry;
      }

      // If the worker has never requested the event creaate it
      let entryEvent = entry.events[event];
      if (!entryEvent) {
        entryEvent = {
          event: event,
          count: 0,
          listener: (...data) => {
            worker.send({
              type: 'response',
              event: event,
              params: data
            });
          },
        };
        this._responseEntries[worker.id].events[event] = entryEvent;
        this._addResponseEventListener(event, entryEvent.listener);
      }
      this._responseEntries[worker.id].events[event].count++;
    }

    _handleRemoveResponseListener(worker, msg) {
      const event = msg.event;
      const entry = this._responseEntries[worker.id];
      if (entry) {
        const entryEvent = entry.events[event];
        if (entryEvent) {
          entryEvent.count--;
          if (entryEvent.count <= 0) {
            this._removeResponseEventListener(event, entryEvent.listener);
            delete entry.events[event];
          }
          if (entry.events.length <= 0) {
            delete this._responseEntries[worker.id];
          }
        } else {
          logger.error('Can not remove request for entry we know nothing about');
        }
      } else {
        logger.error('Trying to remove a worker that we dont know of');
      }
    }

    _handleAddEventSubscriberListener(worker, msg) {
      const event = msg.event;

      let entry = this._eventSubscriberEntries[worker.id];

      // If there is no entry we need to create one for that particular worker
      if (!entry) {
        entry = {
          workerId: worker.id,
          events: {},
        };
        this._eventSubscriberEntries[worker.id] = entry;
      }

      // If the worker has never requested the event creaate it
      let entryEvent = entry.events[event];
      if (!entryEvent) {
        entryEvent = {
          event: event,
          count: 0,

          listener: (...data) => {
            worker.send({
              type: 'eventsubscribed',
              event: event,
              params: data
            });
          },
        };
        this._eventSubscriberEntries[worker.id].events[event] = entryEvent;
        this._addEventSubscriberListener(event, entryEvent.listener);
      }
      this._eventSubscriberEntries[worker.id].events[event].count++;
    }

    _handleRemoveEventSubscriberListener(worker, msg) {
      const event = msg.event;
      const entry = this._eventSubscriberEntries[worker.id];
      if (entry) {
        const entryEvent = entry.events[event];
        if (entryEvent) {
          entryEvent.count--;
          if (entryEvent.count <= 0) {
            this._handleRemoveEventSubscriberListener(event, entryEvent.listener);
            delete entry.events[event];
          }
          if (entryEvent.length <= 0) {
            delete this._requestEntries[worker.id];
          }
        } else {
          logger.error('Can not remove subscriber for entry we know nothing about', msg);
        }
      } else {
        logger.error('Trying to remove a worker that we dont know of', msg);
      }
    }

    _isValidEvent(event) {
      return 'string' === typeof(event) && 0 < event.length;
    }

    _isValidScopes(scopes) {
      return null === scopes || Array.isArray(scopes);
    }

    _isValidUser(user) {
      return null === user || user._id;
    }

    _isValidListener(listener) {
      return 'function' === typeof(listener);
    }

    _deleteEventListener(event, listener) {
      let metadata = {};
      let handler = this._handlers.find((handler) => {
        return (handler.event === event && handler.listener === listener);
      });
      if (handler) {
        metadata = handler.metadata;
      } else {
        logger.warn('Could not find metadata object to add');
      }

      this.process.send({
        type: 'removeEventListener',
        event: event,
        metadata: metadata
      });
    }

    _newEventListener(event, listener) {
      let metadata = {};

      let handler = this._handlers.find((handler) => {
        return (handler.event === event && handler.listener === listener);
      });
      if (handler) {
        metadata = handler.metadata;
      } else {
        logger.warn('Could not find metadata object to add');
      }

      this.process.send({
        type: 'addEventListener',
        event: event,
        metadata: metadata
      });
    }

    _removeRequestListener(event, listener) {
      this.process.send({
        type: 'removeRequestListener',
        event: event
      });
    }

    _newRequestListener(event, listener) {
      this.process.send({
        type: 'addRequestListener',
        event: event
      });
    }

    _removeResponseListener(event, listener) {
      this.process.send({
        type: 'removeResponseListener',
        event: event
      });
    }

    _newResponseListener(event, listener) {
      this.process.send({
        type: 'addResponseListener',
        event: event
      });
    }
    _removeEventSubscriberListener(event, listener) {
      this.process.send({
        type: 'removeEventSubscriberListener',
        event: event
      });
    }

    _newEventSubscriberListener(event, listener) {
      this.process.send({
        type: 'addEventSubscriberListener',
        event: event
      });
    }

    _message(message) {
      const event = message.event;
      if ('event' === message.type) {
        const params = message.params;
        this._eventEmitter.emit(event, ...params);
      } else if ('request' === message.type) {
        const params = message.params;
        this._requestEmitter.emit(event, ...params);
      } else if ('response' === message.type) {
        this._responseEmitter.emit(event, ...message.params);
      } else if ('eventsubscribed' === message.type) {
        this._eventSubscriberEmitter.emit(event, ...message.params);
      } else {
        logger.error('Trying to emit a message of type %s for event %s but we cant process that event', message.type, event);
      }
    }

    sendEvent(event, metadata, ...data) {
      if (!metadata) {
        metadata = {};
      }
      if (!metadata.scopes) {
        metadata.scopes = null;
      }

      const scopes = metadata.scopes;
      if (!this._isValidEvent(event)) {
        return Promise.reject(new TypeError('event must be a non-empty string.'));
      } else if (!this._isValidScopes(scopes)) {
        return Promise.reject(new TypeError('scopes must be null or an Array.'));
      }
      if (this.cluster.isMaster) {
        this._eventEmitter.emit(event, metadata, ...data);
      } else if (this.cluster.isWorker) {
        this.process.send({
          type: 'event',
          event: event,
          params: [metadata].concat(data)
        });
      }
      return Promise.resolve();
    }

    _sendRequest(event, requestId, ...data) {
      if (this.cluster.isMaster) {
        const exists = this._allRequests.some((element) => {
          return element === event;
        });
        if (exists) {
          this._requestEmitter.emit(event, requestId, ...data);
        } else {
          return this._sendResponse(event, requestId, `No listeners subscribed to ${event}`, null);
        }
      } else if (this.cluster.isWorker) {
        this.process.send({
          type: 'request',
          event: event,
          requestId: requestId,
          params: data
        });
      }
      return Promise.resolve();
    }

    _sendResponse(event, responseId, err, result) {
      if (this.cluster.isMaster) {
        this._responseEmitter.emit(event, responseId, err, result);
      } else if (this.cluster.isWorker) {
        this.process.send({
          type: 'response',
          event: event,
          responseId: responseId,
          err: err,
          result: result
        });
      }
      return Promise.resolve();
    }

    sendRequest(event, metadata, ...data) {
      if (!metadata) {
        metadata = {};
      }
      if (!metadata.scopes) {
        metadata.scopes = null;
      }

      const scopes = metadata.scopes;
      if (!this._isValidEvent(event)) {
        return Promise.reject(new TypeError('event must be a non-empty string.'));
      } else if (!this._isValidScopes(scopes)) {
        return Promise.reject(new TypeError('scopes must be null or an Array.'));
      }
      return new Promise((resolve, reject) => {
        this._requestId++;
        if (this._requestId >= (Number.MAX_SAFE_INTEGER - 1)) {
          this._requestId = 0;
        }
        const requestId = (this._requestId).toString();
        const handleRequest = (responseId, err, result) => {
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

    addEventListener(event, metadata, listener) {
      let scopes = null;
      let user = null;

      if (this._isValidScopes(metadata)) {
        scopes = metadata;
        metadata = {
          scopes: metadata
        };
      } else {
        scopes = metadata.scopes;
        user = metadata.user;
      }

      if (!this._isValidEvent(event)) {
        return Promise.reject(new TypeError('event must be a non-empty String.'));
      } else if (!this._isValidScopes(scopes) && !this._isValidUser(user)) {
        return Promise.reject(new TypeError('metadata must have scopes or user'));
      } else if (!this._isValidListener(listener)) {
        return Promise.reject(new TypeError('listener must be a function.'));
      }

      // Fill in the metadata
      metadata.event = event;

      const eventHandle = {};
      eventHandle.event = event;
      eventHandle.metadata = metadata;
      eventHandle.originalListener = listener;
      eventHandle.listener = (metadata, ...data) => {
        const eventUser = metadata.user;
        const eventScopes = metadata.scopes;
        if (!this._isValidScopes(eventScopes) && !this._isValidUser(user)) {
          logger.warn('Event listener must be called with metadata, user or scopes allowed ... bad developer!: ', event, eventScopes, data);
          return;
        }

        if (this._passesFilter(eventScopes, scopes, eventUser, user)) {
          return eventHandle.originalListener(...data);
        }
      };
      this._handlers.push(eventHandle);
      this._addEventListener(event, eventHandle.listener, metadata);
      return Promise.resolve();
    }

    removeEventListener(event, scopes, listener) {
      if ('function' === typeof(scopes)) {
        listener = scopes;
      }
      if (!this._isValidEvent(event)) {
        return Promise.reject(new TypeError('event must be a non-empty string.'));
      } else if (!this._isValidListener(listener)) {
        return Promise.reject(new TypeError('listener must be a function.'));
      }
      const size = this._handlers.length;
      this._handlers = this._handlers.filter((eventHandle) => {
        if ((event === eventHandle.event && eventHandle.originalListener === listener)) {
          this._removeEventListener(eventHandle.event, eventHandle.listener, eventHandle.metadata);
          return false;
        } else {
          return true;
        }
      });

      if (size === this._handlers.length) {
        logger.error('Could not remove event listener for ', event);
        return Promise.reject(new Error('Unable to remove event listener because it does not exist ' + event));
      }
      return Promise.resolve();
    }

    addRequestListener(event, metadata, listener) {
      let scopes = null;
      // let user = null;

      if (this._isValidScopes(metadata)) {
        scopes = metadata;
        metadata = {
          scopes: metadata
        };
      } else {
        scopes = metadata.scopes;
        // user = metadata.user;
      }

      if (!this._isValidEvent(event)) {
        return Promise.reject(new TypeError('event must be a non-empty string.'));
      } else if (!this._isValidScopes(scopes)) {
        return Promise.reject(new TypeError('metadata must have scopes or user'));
      } else if (!this._isValidListener(listener)) {
        return Promise.reject(new TypeError('listener must be a function.'));
      }
      const request = {};
      request.event = event;
      request.originalListener = listener;
      request.listener = (requestId, metadata, ...data) => {
        const requestScopes = metadata.scopes;
        if ('string' !== typeof(requestId) || 0 >= requestId.length) {
          logger.warn('Request listener must be called with a requestId...bad developer!: ', event, requestId, requestScopes, data);
          return;
        }
        // Provide the requestId in case the handler wants it
        metadata.requestId = requestId;

        if (!this._isValidScopes(requestScopes)) {
          logger.warn('Request listener must be called with a scope array ... bad developer!: ', event, requestId, requestScopes, data);
          return;
        }

        if (requestScopes && scopes === null) {
          this._sendResponse(event, requestId, {
            error: 'You dont have permissions to make this request ' + event,
            reason: 'PERMISSIONS',
            event: event,
            handleText: 'Okay'
          }, null);
          return Promise.resolve();
        } else if (requestScopes && scopes) {
          const scopeMatch = scopes.every((scope) => {
            return requestScopes.includes(scope);
          });
          if (!scopeMatch) {
            this._sendResponse(event, requestId, {
              error: 'You dont have permissions to make this request ' + event,
              reason: 'PERMISSIONS',
              event: event,
              handleText: 'Okay'
            }, null);
            return Promise.resolve();
          }
        }

        return Promise.resolve()
        .then(() => listener(metadata, ...data))
        .then((result) => this._sendResponse(event, requestId, null, result))
        .catch((err) => {
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
      };
      this._addRequestEventListener(event, request.listener);

      this._requests.push(request);
      return Promise.resolve();
    }

    removeRequestListener(event, listener) {
      if (!this._isValidEvent(event)) {
        return Promise.reject(new TypeError('event must be a non-empty string.'));
      } else if (!this._isValidListener(listener)) {
        return Promise.reject(new TypeError('listener must be a function.'));
      }

      const size = this._requests.length;
      this._requests = this._requests.filter((request) => {
        if ((event === request.event && request.originalListener === listener)) {
          this._removeRequestEventListener(request.event, request.listener);
          return false;
        } else {
          return true;
        }
      });

      if (size === this._requests.length) {
        logger.warn('Could not remove event listener for ', event);
        return Promise.reject(new Error('Unable to remove event listener because it does not exist'));
      }
      return Promise.resolve();
    }

    addEventSubscriberListener(event, listener) {
      if (!this._isValidEvent(event)) {
        return Promise.reject(new TypeError('event must be a non-empty String.'));
      } else if (!this._isValidListener(listener)) {
        return Promise.reject(new TypeError('listener must be a function.'));
      }

      const eventHandle = {};
      eventHandle.event = event;
      eventHandle.originalListener = listener;
      eventHandle.listener = (metadata, ...data) => {
        eventHandle.originalListener(metadata, ...data);
      };
      this._eventSubscriberhandlers.push(eventHandle);
      this._addEventSubscriberListener(event, eventHandle.listener);
      return Promise.resolve();
    }

    removeEventSubscriberListener(event, listener) {
      if (!this._isValidEvent(event)) {
        return Promise.reject(new TypeError('event must be a non-empty string.'));
      } else if (!this._isValidListener(listener)) {
        return Promise.reject(new TypeError('listener must be a function.'));
      }
      const size = this._eventSubscriberhandlers.length;
      this._eventSubscriberhandlers = this._eventSubscriberhandlers.filter((eventHandle) => {
        if ((event === eventHandle.event && eventHandle.originalListener === listener)) {
          this._removeEventSubscriberListener(eventHandle.event, eventHandle.listener);
          return false;
        } else {
          return true;
        }
      });

      if (size === this._eventSubscriberhandlers.length) {
        logger.error('Could not remove event listener for ', event);
        return Promise.reject(new Error('Unable to remove event subscriber listener because it does not exist ' + event));
      }
      return Promise.resolve();
    }

    _addEventListener(event, listener, metadata) {
      this._eventEmitter.on(event, listener);
      this._allEvents.push(event);

      if (!metadata) {
        metadata = {};
      }
      if (this.cluster.isMaster) {
        metadata.event = event;
        metadata.what = 'added';
        this._eventSubscriberEmitter.emit(event, metadata);
      }

      return Promise.resolve();
    }

    _removeEventListener(event, listener, metadata) {
      this._eventEmitter.removeListener(event, listener);
      this._allEvents = this._allEvents.filter((e) => {
        return e !== event;
      });

      if (this.cluster.isMaster) {
        metadata.event = event;
        metadata.what = 'removed';
        this._eventSubscriberEmitter.emit(event, metadata);
      }
      return Promise.resolve();
    }

    _addRequestEventListener(event, listener) {
      this._requestEmitter.on(event, listener);
      this._allRequests.push(event);

      return Promise.resolve();
    }

    _removeRequestEventListener(event, listener) {
      this._requestEmitter.removeListener(event, listener);
      this._allRequests = this._allRequests.filter((e) => {
        return e !== event;
      });

      return Promise.resolve();
    }

    _addResponseEventListener(event, listener) {
      this._responseEmitter.on(event, listener);
      return Promise.resolve();
    }

    _removeResponseEventListener(event, listener) {
      this._responseEmitter.removeListener(event, listener);
      return Promise.resolve();
    }

    _addEventSubscriberListener(event, listener) {
      this._eventSubscriberEmitter.on(event, listener);
      return Promise.resolve();
    }

    _removeEventSubscriberListener(event, listener) {
      this._eventSubscriberEmitter.removeListener(event, listener);
      return Promise.resolve();
    }

    _passesFilter(scopesToSend, requestedScopes, userToSend, requestedUser) {
      // If a user was specified then use that
      if (userToSend && requestedUser) {
        return userToSend.id === requestedUser.id;
      }

      // Else process the scopes the normal way
      if (null === requestedScopes) {
        if (!requestedUser && userToSend) {
          return false;
        } else {
          return true;
        }
      } else {
        if (null !== scopesToSend) {
          const hasScope = scopesToSend.every((scope) => {
            return requestedScopes.includes(scope);
          });
          if (hasScope) {
            return true;
          } else {
            return false;
          }
        }
      }
      return false;
    }
  }

  module.exports = MessageCenter;
})();
