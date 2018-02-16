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

    /**
     * Cleanup the result object from create, update, delete
     * @param {object} item
     * @return {Promise}
     */
    sanitize(item) {
      return Promise.resolve(item);
    }

    /**
     * Stub implementation of filter.
     * Filter the item(s) emitted over the socket after CRUD events based on the
     * supplied implementation of this function. Handles all CRUD events. For specific CRUD filters
     * see {@link CrudMessenger.filterCreated}, {@link CrudMessenger.filterUpdated}, {@link CrudMessenger.filterDeleted}
     * @param {object} user current user for the filter
     * @param {object} item to run the filter on
     * @return {*} the item if it meets the filter criteria
     */
    filter(user, item) {
      return true;
    }

    /**
     * Filter to run on POST CRUD events IE (created, updated, deleted).
     * Override the {@link CrudMessenger.filter} method to provide a specific implementation
     * using a JavaScript Array.filter interface IE(return true to keep the element)
     * @param {object} user the user of the client socket (can filter users with this)
     * @param {object} item the item from the CRUD operation
     * @private
     * @return {promise} the filtered results
     */
    _filter(user, item) {
      if (Array.isArray(item)) {
        return Promise.resolve(item.filter((item) => this.filter(user, item)));
      } else {
        if (this.filter(user, item)) {
          return Promise.resolve(item);
        }
        return Promise.resolve(null);
      }
    }

    /**
     * Prevent emitting 'created' events originated by the CRUD Manager
     * over the socket to modules/clients that match the specified filter.
     * Override this method in your messenger implementation to provide a filter
     * specifically for the 'created' event.
     * NOTE: You may override the 'filter' function instead of 'filterCreated'.
     * @param {object} user the current user for the socket event
     * @param {array} items the items that were 'created' by the CRUD Manager
     * @return {promise} the filtered items
     */
    filterCreated(user, items) {
      return this._filter(user, items);
    }

    /**
     * Prevent emitting 'updated' events originated by the CRUD Manager
     * over the socket to modules/clients that match the specified filter.
     * Override this method in your messenger implementation to provide a filter
     * specifically for the 'updated' event.
     * NOTE: You may override the 'filter' function instead of 'filterUpdated'.
     * @param {object} user the current user for the socket event
     * @param {array} items the items that were 'created' by the CRUD Manager
     * @return {promise} the filtered items
     */
    filterUpdated(user, items) {
      return this._filter(user, items);
    }

    /**
     * Prevent emitting 'deleted' events originated by the CRUD Manager
     * over the socket to modules/clients that match the specified filter.
     * Override this method in your messenger implementation to provide a filter
     * specifically for the 'deleted' event.
     * NOTE: You may override the 'filter' function instead of 'filterDeleted'.
     * @param {object} user the current user for the socket event
     * @param {array} items {array} the items that were 'created' by the CRUD Manager
     * @return {promise} the filtered items
     */
    filterDeleted(user, items) {
      return this._filter(user, items);
    }

    /**
     * Event handler for incoming 'create' events.
     * Forwards the request to the {@link CrudManager}
     * @param {object} metadata request metadata from the bits server socket IE(user, etc...)
     * @param {array|object} item the record(s) to create
     * @return {promise} to create the item.
     * @private
     */
    _create(metadata, item) {
      return Promise.resolve()
      .then(() => this._manager.create(item))
      .then((item) => this._sanitize(item));
    }

    /**
     * Event handler for incoming 'count' events.
     * Forwards the request to the {@link CrudManager}
     * @param {object} metadata request metadata from the bits server socket IE(user, etc...)
     * @param {object} query parameters for filtering the count
     * @return {promise} to return a list of items from the manager that match the query.
     * @private
     */
    _count(metadata, query) {
      return Promise.resolve()
      .then(() => this._manager.count(query));
    }

    /**
     * Event handler for incoming 'list' events.
     * Forwards the request to the {@link CrudManager}
     * @param {object} metadata request metadata from the bits server socket IE(user, etc...)
     * @param {object} query parameters for filtering the count
     * @param {options} options for the manager IE (limit, etc...)
     * @return {promise} to return a list of items from the manager that match the query.
     * @private
     */
    _list(metadata, query, options) {
      return Promise.resolve()
      .then(() => this._manager.list(query, options))
      .then((items) => Promise.all(items.map((item) => this._sanitize(item))));
    }

    /**
     * Event handler for incoming 'get' events.
     * Forwards the request to the {@link CrudManager}
     * @param {object} metadata request metadata from the bits server socket IE(user, etc...)
     * @param {string} id the record id to lookup
     * @return {promise} to return the record matching the id
     * @private
     */
    _get(metadata, id) {
      return Promise.resolve()
      .then(() => this._manager.get(id))
      .then((item) => this._sanitize(item));
    }

    /**
     * Event handler for incoming 'update' events.
     * Forwards the request to the {@link CrudManager}
     * @param {object} metadata request metadata from the bits server socket IE(user, etc...)
     * @param {string} id the record id to lookup
     * @param {object} update the changes to make to the record
     * @return {promise} to update the record matching the id
     * @private
     */
    _update(metadata, id, update) {
      return Promise.resolve()
      .then(() => this._manager.update(id, update))
      .then((item) => this._sanitize(item));
    }

    /**
     * Event handler for incoming 'delete' events.
     * Forwards the request to the {@link CrudManager}
     * @param {object} metadata request metadata from the bits server socket IE(user, etc...)
     * @param {string} id the record id to delete
     * @return {promise} to delete the record matching the id
     * @private
     */
    _delete(metadata, id) {
      return Promise.resolve()
      .then(() => this._manager.delete(id))
      .then((item) => this._sanitize(item));
    }

    /**
     * Get a list of subscriber id's for the given event
     * @param {string} event the CRUD event to get subscribers for
     * @return {array} an array of subscriber id's for the event
     * @private
     */
    _getSubscriberIds(event) {
      let subscribers = null;

      switch (event) {
      case 'created':
        subscribers = Object.keys(this._subscribedCreatedUsers);
        break;

      case 'updated':
        subscribers = Object.keys(this._subscribedUpdatedUsers);
        break;

      case 'deleted':
        subscribers = Object.keys(this._subscribedDeletedUsers);
        break;

      default:
        subscribers = [];
        break;
      }

      return subscribers;
    }

    _getSubscriberFromId(key, event) {
      let subscriberId = null;

      switch (event) {
      case 'created':
        subscriberId = this._subscribedCreatedUsers[key];
        break;

      case 'updated':
        subscriberId = this._subscribedUpdatedUsers[key];
        break;

      case 'deleted':
        subscriberId = this._subscribedDeletedUsers[key];
        break;

      default:
        subscriberId = [];
        break;
      }

      return subscriberId;
    }

    /**
     * Determine and apply the correct filter for the given event
     * @param {string} event the event to emit
     * @param {object} user logged into the socket connection
     * @param {array|object} items the data for the event
     * @return {promise} to filter the item(s)
     * @private
     */
    _handleFilter(event, user, items) {
      switch (event) {
      case 'created':
        return this.filterCreated(user, items);

      case 'updated':
        return this.filterUpdated(user, items);

      case 'deleted':
        return this.filterDeleted(user, items);

      default:
        return Promise.resolve(items);
      }
    }

    /**
     * Emit the event to all server components. IE (scopes do not matter)
     * @param {array|object} item the item(s) to package with the event
     * @param {string} event the event to emit
     * @return {promise} a promise to emit the event
     * @private
     */
    _notifyServerSideSubscribers(item, event) {
      return Promise.resolve()
      .then(() => this.sendEvent(`${this._tag} ${event}`, {scopes: null}, item));
    }

    /**
     * Emit the event to user/client subscribers including performing any filtering and sanitizing
     * of the data.
     * @param {array|object} item the item(s) to package with the event
     * @param {string} event the event to emit
     * @return {promise} a promise to emit the event
     * @private
     */
    _notifyClientSideSubscribers(item, event) {
      return Promise.resolve()
      .then(() => {
        return Promise.all(this._getSubscriberIds(event).map((key) => {
          return Promise.resolve()
          .then(() => this._getSubscriberFromId(key, event))
          .then((user) => {
            if ((user !== null) && ('object' === typeof user)) {
              return Promise.resolve()
              .then(() => this._handleFilter(event, user, item))
              .then((item) => this._sanitize(item))
              .then((item) => {
                // User must have the scope to see this event
                return this.sendEvent(`${this._tag} ${event}`, {
                  scopes: this._readScopes,
                  user: this._getSubscriberFromId(key, event)
                }, item);
              })
              .catch((err) => {
                if (!(err && err.reason === 'failed')) {
                  logger.error(`Unable to filter the ${event} event`, this._tag, err);
                }
              });
            }
          });
        }));
      });
    }

    /**
     * Emit Post CRUD operation events IE(created, updated, deleted) received from this messenger's manager.
     * If {@link CrudMessenger._shouldFilter} is set to true the event will be sent to all server components
     * and then any filter applied to the user/client facing subscribers.
     * @param {array| object} item the post CRUD item(s) sent from the manager
     * @param {string} event the literal event string IE(created, updated, deleted)
     * @return {promise} a promise to emit the event
     * @private
     */
    _notifyPostCrud(item, event) {
      return Promise.resolve()
      .then(() => {
        if (this._shouldFilter) {
          // Send to all server components regardless and then filter the user/client components
          return Promise.resolve()
          .then(() => this._notifyServerSideSubscribers(item, event))
          .then(() => this._notifyClientSideSubscribers(item, event));
        } else {
          // Just send the event to everyone
          return Promise.resolve()
          .then(() => this._sanitize(item))
          .then((item) => this.sendEvent(`${this._tag} ${event}`, {scopes: this._readScopes}, item));
        }
      })
      .catch((err) => {
        logger.error(`Unable to send ${event} event`, err);
      });
    }

    /**
     * Event handler for when the manager emits 'created'
     * @param {array|object} item the post event item(s)
     * @return {promise} to notify and filter subscribed clients
     * @private
     */
    _created(item) {
      return Promise.resolve()
      .then(() => this._notifyPostCrud(item, 'created'));
    }

    /**
     * Event handler for when the manager emits 'updated'
     * @param {array|object} item the post event item(s)
     * @return {promise} to notify and filter subscribed clients
     * @private
     */
    _updated(item) {
      return Promise.resolve()
      .then(() => this._notifyPostCrud(item, 'updated'));
    }

    /**
     * Event handler for when the manager emits 'deleted'
     * @param {array|object} item the post event item(s)
     * @return {promise} to notify and filter subscribed clients
     * @private
     */
    _deleted(item) {
      return Promise.resolve()
      .then(() => this._notifyPostCrud(item, 'deleted'));
    }
  }

  module.exports = CrudMessenger;
})();
