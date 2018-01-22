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
  const Messenger = require('./messenger');
  const ScopesUtil = require('./../scopes/scopes-util');
  const CrudApi = require('./crud-api');
  const logger = global.LoggerFactory.getLogger();

  class CrudMessenger extends Messenger {
    constructor(tag, manager, {
      scopes = CrudApi.DEFAULT_SCOPES,
      readScopes = scopes,
      writeScopes = scopes
    } = {}, {
      filter = false
    } = {}) {
      super();
      if (!CrudApi.isValidTag(tag)) {
        throw new TypeError('tag must be a non-empty string.');
      }
      this._tag = tag;
      if (!(manager instanceof EventEmitter)) {
        throw new TypeError('manager must be an EventEmitter.');
      }
      this._manager = manager;
      if (!ScopesUtil.isValidScopes(readScopes)) {
        readScopes = CrudApi.DEFAULT_SCOPES;
      }
      this._readScopes = readScopes;
      if (!ScopesUtil.isValidScopes(writeScopes)) {
        writeScopes = CrudApi.DEFAULT_SCOPES;
      }
      this._writeScopes = writeScopes;

      this._subscribedCreatedUsers = {};
      this._subscribedUpdatedUsers = {};
      this._subscribedDeletedUsers = {};

      this.addRequestListener(`${this._tag} create`, {scopes: this._writeScopes}, this._create.bind(this));
      this.addRequestListener(`${this._tag} count`, {scopes: this._readScopes}, this._count.bind(this));
      this.addRequestListener(`${this._tag} list`, {scopes: this._readScopes}, this._list.bind(this));
      this.addRequestListener(`${this._tag} get`, {scopes: this._readScopes}, this._get.bind(this));
      this.addRequestListener(`${this._tag} update`, {scopes: this._writeScopes}, this._update.bind(this));
      this.addRequestListener(`${this._tag} delete`, {scopes: this._writeScopes}, this._delete.bind(this));
      this.addEmitterEventListener(this._manager, 'created', this._created.bind(this));
      this.addEmitterEventListener(this._manager, 'updated', this._updated.bind(this));
      this.addEmitterEventListener(this._manager, 'deleted', this._deleted.bind(this));

      this._shouldFilter = filter;

      if (filter) {
        this.addEventSubscriberListener(`${this._tag} created`, this._createdSubscriberUpdate.bind(this));
        this.addEventSubscriberListener(`${this._tag} updated`, this._updatedSubscriberUpdate.bind(this));
        this.addEventSubscriberListener(`${this._tag} deleted`, this._deletedSubscriberUpdate.bind(this));
      }
    }

    _createdSubscriberUpdate(metadata) {
      if (metadata.what === 'added') {
        return this._subscribeToCreatedEvent(metadata.user);
      } else if (metadata.what === 'removed') {
        return this._unsubscribeToCreatedEvent(metadata.user);
      }
    }

    _subscribeToCreatedEvent(user) {
      if (user) {
        if (this._subscribedCreatedUsers[user.id]) {
          this._subscribedCreatedUsers[user.id].count += 1;
        } else {
          this._subscribedCreatedUsers[user.id] = user;
          this._subscribedCreatedUsers[user.id].count = 1;
        }
      }
    }

    _unsubscribeToCreatedEvent(user) {
      if (user) {
        if (!this._subscribedCreatedUsers[user.id]) {
          logger.error('Error unsubscribing user for %s user does not exist', this._tag, user.username);
        } else {
          this._subscribedCreatedUsers[user.id].count -= 1;
          if (this._subscribedCreatedUsers[user.id].count <= 0) {
            delete this._subscribedCreatedUsers[user.id];
          }
        }
      }
    }

    _updatedSubscriberUpdate(metadata) {
      if (metadata.what === 'added') {
        return this._subscribeToUpdatedEvent(metadata.user);
      } else if (metadata.what === 'removed') {
        return this._unsubscribeToUpdatedEvent(metadata.user);
      }
    }

    _subscribeToUpdatedEvent(user) {
      if (user) {
        if (this._subscribedUpdatedUsers[user.id]) {
          this._subscribedUpdatedUsers[user.id].count += 1;
        } else {
          this._subscribedUpdatedUsers[user.id] = user;
          this._subscribedUpdatedUsers[user.id].count = 1;
        }
      }
    }

    _unsubscribeToUpdatedEvent(user) {
      if (user) {
        if (!this._subscribedUpdatedUsers[user.id]) {
          logger.error('Error unsubscribing user for %s user does not exist', this._tag, user.username);
        } else {
          this._subscribedUpdatedUsers[user.id].count -= 1;
          if (this._subscribedUpdatedUsers[user.id].count <= 0) {
            delete this._subscribedUpdatedUsers[user.id];
          }
        }
      }
    }

    _deletedSubscriberUpdate(metadata) {
      if (metadata.what === 'added') {
        return this._subscribeToDeletedEvent(metadata.user);
      } else if (metadata.what === 'removed') {
        return this._unsubscribeToDeletedEvent(metadata.user);
      }
    }

    _subscribeToDeletedEvent(user) {
      if (user) {
        if (this._subscribedDeletedUsers[user.id]) {
          this._subscribedDeletedUsers[user.id].count += 1;
        } else {
          this._subscribedDeletedUsers[user.id] = user;
          this._subscribedDeletedUsers[user.id].count = 1;
        }
      }
    }

    _unsubscribeToDeletedEvent(user) {
      if (user) {
        if (!this._subscribedDeletedUsers[user.id]) {
          logger.error('Error unsubscribing user for %s user does not exist', this._tag, user.username);
        } else {
          this._subscribedDeletedUsers[user.id].count -= 1;
          if (this._subscribedDeletedUsers[user.id].count <= 0) {
            delete this._subscribedDeletedUsers[user.id];
          }
        }
      }
    }

    _sanitize(item) {
      if (Array.isArray(item)) {
        return Promise.all(item.map((i) => this.sanitize(i)));
      } else {
        return this.sanitize(item);
      }
    }

    sanitize(item) {
      return Promise.resolve(item);
    }

    filterCreated(user, items) {
      return Promise.resolve(items);
    }

    filterUpdated(user, items) {
      return Promise.resolve(items);
    }

    filterDeleted(user, items) {
      return Promise.resolve(items);
    }

    _create(metadata, item) {
      return Promise.resolve()
      .then(() => this._manager.create(item))
      .then((item) => this._sanitize(item));
    }

    _count(metadata, query) {
      return Promise.resolve()
      .then(() => this._manager.count(query));
    }

    _list(metadata, query, options) {
      return Promise.resolve()
      .then(() => this._manager.list(query, options))
      .then((items) => Promise.all(items.map((item) => this._sanitize(item))));
    }

    _get(metadata, id) {
      return Promise.resolve()
      .then(() => this._manager.get(id))
      .then((item) => this._sanitize(item));
    }

    _update(metadata, id, update) {
      return Promise.resolve()
      .then(() => this._manager.update(id, update))
      .then((item) => this._sanitize(item));
    }

    _delete(metadata, id) {
      return Promise.resolve()
      .then(() => this._manager.delete(id))
      .then((item) => this._sanitize(item));
    }

    _created(item) {
      return Promise.resolve()
      .then(() => {
        if (this._shouldFilter) {
          return Promise.resolve()
          .then(() => this.sendEvent(`${this._tag} created`, {
            scopes: null
          }, item))
          .then(() => Promise.all(Object.keys(this._subscribedCreatedUsers).map((key) => {
            return Promise.resolve()
            .then(() => this._subscribedCreatedUsers[key])
            .then((user) => this.filterCreated(user, item))
            .then((item) => this._sanitize(item))
            .then((item) => this.sendEvent(`${this._tag} created`, {
              scopes: this._readScopes,
              user: this._subscribedCreatedUsers[key]
            }, item))
            .catch((err) => {
              if (!(err && err.reason === 'failed')) {
                logger.error('Unable to filter the created event', this._tag, err);
              }
            }); // If the user does not have permission they he doesnt see it
          })));
        } else {
          return Promise.resolve()
          .then(() => this._sanitize(item))
          .then((item) => {
            return this.sendEvent(`${this._tag} created`, {
              scopes: this._readScopes
            }, item);
          });
        }
      })
      .catch((err) => {
        logger.error('Unable to send create update', err);
      });
    }

    _updated(item) {
      return Promise.resolve()
      .then(() => {
        if (this._shouldFilter) {
          return Promise.resolve()
          .then(() => this._sanitize(item))
          .then((item) => this.sendEvent(`${this._tag} updated`, {
            scopes: null
          }, item))
          .then(() => Promise.all(Object.keys(this._subscribedUpdatedUsers).map((key) => {
            return Promise.resolve()
            .then(() => this._subscribedUpdatedUsers[key])
            .then((user) => this.filterUpdated(user, item))
            .then((item) => this._sanitize(item))
            .then((item) => this.sendEvent(`${this._tag} updated`, {
              scopes: this._readScopes,
              user: this._subscribedCreatedUsers[key]
            }, item))
            .catch((err) => {
              if (!(err && err.reason === 'failed')) {
                logger.error('Unable to filter the created event', this._tag, err);
              }
            }); // If the user does not have permission they he doesnt see it
          })));
        } else {
          return Promise.resolve()
          .then(() => this._sanitize(item))
          .then((item) => {
            return this.sendEvent(`${this._tag} updated`, {
              scopes: this._readScopes
            }, item);
          });
        }
      })
      .catch((err) => {
        logger.error('Unable to send update update', err);
      });
    }

    _deleted(item) {
      return Promise.resolve()
      .then(() => {
        if (this._shouldFilter) {
          return Promise.resolve()
          .then(() => this._sanitize(item))
          .then((item) => this.sendEvent(`${this._tag} deleted`, {
            scopes: null
          }, item))
          .then(() => Promise.all(Object.keys(this._subscribedDeletedUsers).map((key) => {
            return Promise.resolve()
            .then(() => this._subscribedDeletedUsers[key])
            .then((user) => this.filterDeleted(user, item))
            .then((item) => this._sanitize(item))
            .then((item) => this.sendEvent(`${this._tag} deleted`, {
              scopes: this._readScopes,
              user: this._subscribedCreatedUsers[key]
            }, item))
            .catch((err) => {
              if (!(err && err.reason === 'failed')) {
                logger.error('Unable to filter the created event', this._tag, err);
              }
            }); // If the user does not have permission they he doesnt see it
          })));
        } else {
          return Promise.resolve()
          .then(() => this._sanitize(item))
          .then((item) => {
            return this.sendEvent(`${this._tag} deleted`, {
              scopes: this._readScopes
            }, item);
          });
        }
      })
      .catch((err) => {
        logger.error('Unable to send delete update', err);
      });
    }
  }

  module.exports = CrudMessenger;
})();
