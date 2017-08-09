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
  const logger = global.LoggerFactory.getLogger();

  class Messenger {
    constructor() {
      this._requests = [];
      this._events = [];
      this._emitterEvents = [];
      this._eventSubscribers = [];

      this._messageCenter = null;
    }

    load(messageCenter) {
      return Promise.resolve()
      .then(() => {
        this._messageCenter = messageCenter;
      })
      .then(() => {
        return this._requests.reduce((chain, obj) => {
          const event = obj.event;
          const scopes = obj.scopes;
          const listener = obj.listener;
          return chain.then(() => this._messageCenter.addRequestListener(event, scopes, listener));
        }, Promise.resolve());
      })
      .then(() => {
        return this._events.reduce((chain, obj) => {
          const event = obj.event;
          const scopes = obj.scopes;
          const listener = obj.listener;
          return chain.then(() => this._messageCenter.addEventListener(event, scopes, listener));
        }, Promise.resolve());
      })
      .then(() => {
        return this._eventSubscribers.reduce((chain, obj) => {
          const event = obj.event;
          const listener = obj.listener;
          return chain.then(() => this._messageCenter.addEventSubscriberListener(event, listener));
        }, Promise.resolve());
      })
      .then(() => {
        this._emitterEvents.forEach((obj) => {
          obj.emitter.addListener(obj.event, obj.listener);
        });
      });
    }

    unload() {
      return Promise.resolve()
      .then(() => {
        return this._requests.reduce((chain, obj) => {
          const event = obj.event;
          const listener = obj.listener;
          return chain.then(() => this._messageCenter.removeRequestListener(event, listener));
        }, Promise.resolve());
      })
      .then(() => {
        return this._events.reduce((chain, obj) => {
          const event = obj.event;
          const listener = obj.listener;
          return chain.then(() => this._messageCenter.removeEventListener(event, listener));
        }, Promise.resolve());
      })
      .then(() => {
        return this._eventSubscribers.reduce((chain, obj) => {
          const event = obj.event;
          const listener = obj.listener;
          return chain.then(() => this._messageCenter.removeEventSubscriberListener(event, listener));
        }, Promise.resolve());
      })
      .then(() => {
        this._emitterEvents.forEach((obj) => {
          obj.emitter.removeListener(obj.event, obj.listener);
        });
      })
      .then(() => {
        this._messageCenter = null;
      });
    }

    addRequestListener(event, scopes, listener) {
      return Promise.resolve()
      .then(() => {
        this._requests.push({
          event: event,
          scopes: scopes,
          listener: listener
        });

        if (null !== this._messageCenter) {
          return this._messageCenter.addRequestListener(event, scopes, listener);
        }
      });
    }

    removeRequestListener(event, listener) {
      return Promise.resolve()
      .then(() => {
        const obj = this._requests.find((obj) => event === obj.event && listener === obj.listener);
        if (obj) {
          const index = this._requests.indexOf(obj);
          this._requests.splice(index, 1);

          if (null !== this._messageCenter) {
            return this._messageCenter.removeRequestListener(event, listener);
          }
        } else {
          logger.warn(`Unable to find request listener for event ${event}.`);
        }
      });
    }

    addEventListener(event, scopes, listener) {
      return Promise.resolve()
      .then(() => {
        this._events.push({
          event: event,
          scopes: scopes,
          listener: listener
        });

        if (null !== this._messageCenter) {
          return this._messageCenter.addEventListener(event, scopes, listener);
        }
      });
    }

    removeEventListener(event, listener) {
      return Promise.resolve()
      .then(() => {
        const obj = this._events.find((obj) => event === obj.event && listener === obj.listener);
        if (obj) {
          const index = this._events.indexOf(obj);
          this._events.splice(index, 1);

          if (null !== this._messageCenter) {
            return this._messageCenter.removeEventListener(event, listener);
          }
        } else {
          logger.warn(`Unable to find event listener for event ${event}.`);
        }
      });
    }

    addEventSubscriberListener(event, listener) {
      return Promise.resolve()
      .then(() => {
        this._eventSubscribers.push({
          event: event,
          listener: listener
        });

        if (null !== this._messageCenter) {
          return this._messageCenter.addEventSubscriberListener(event, listener);
        }
      });
    }

    removeEventSubscriberListener(event, listener) {
      return Promise.resolve()
      .then(() => {
        const obj = this._eventSubscribers.find((obj) => event === obj.event && listener === obj.listener);
        if (obj) {
          const index = this._eventSubscribers.indexOf(obj);
          this._eventSubscribers.splice(index, 1);

          if (null !== this._messageCenter) {
            return this._messageCenter.removeEventSubscriberListener(event, listener);
          }
        } else {
          logger.warn(`Unable to find event subscriber listener for event ${event}.`);
        }
      });
    }

    addEmitterEventListener(emitter, event, listener) {
      if (!(emitter instanceof EventEmitter)) {
        throw new TypeError('emitter must be an EventEmitter');
      }
      const obj = {
        emitter: emitter,
        event: event,
        listener: listener
      };
      this._emitterEvents.push(obj);
      if (null !== this._messageCenter) {
        obj.emitter.addListener(obj.event, obj.listener);
      }
      return emitter;
    }

    removeEmitterEventListener(emitter, event, listener) {
      const obj = this._emitterEvents.find((obj) => {
        return emitter === obj.emitter && event === obj.event && listener === obj.listener;
      });
      if (obj) {
        const index = this._emitterEvents.indexOf(obj);
        this._emitterEvents.splice(index, 1);
        if (null !== this._messageCenter) {
          obj.emitter.removeListener(obj.event, obj.listener);
        }
      }
      return emitter;
    }

    sendEvent(...data) {
      if (null === this._messageCenter) {
        logger.warn('MessageCenter is null');
      } else {
        return this._messageCenter.sendEvent(...data)
        .catch((err) => {
          logger.warn('Failed to sendEvent: %s', err.message);
          logger.debug(err.stack);
          throw err;
        });
      }
    }
  }

  module.exports = Messenger;
})();
