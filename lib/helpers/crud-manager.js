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
  const ScopesUtil = require('./../scopes/scopes-util');
  const CrudApi = require('./crud-api');
  const CrudMessenger = require('./crud-messenger');

  class CrudManager extends EventEmitter {
    constructor(tag, {scopes=CrudApi.DEFAULT_SCOPES, readScopes=scopes, writeScopes=scopes, Messenger=null}={}) {
      super();
      if (!CrudApi.isValidTag(tag)) {
        throw new TypeError('tag must be a non-empty string.');
      }
      this._tag = tag;

      if (!ScopesUtil.isValidScopes(readScopes)) {
        readScopes = CrudApi.DEFAULT_SCOPES;
      }
      this._readScopes = readScopes;

      if (!ScopesUtil.isValidScopes(writeScopes)) {
        writeScopes = CrudApi.DEFAULT_SCOPES;
      }
      this._writeScopes = writeScopes;

      this._id = 0;
      this._items = [];

      if (null === Messenger) {
        Messenger = CrudMessenger;
      } else {
        if (!CrudMessenger.isPrototypeOf(Messenger)) {
          throw new TypeError('Messenger must extend CrudMessenger.');
        }
      }
      this._messenger = new Messenger(tag, this, {
        readScopes: readScopes,
        writeScopes: writeScopes
      });
    }

    load(messageCenter) {
      return Promise.resolve()
      .then(() => this._messenger.load(messageCenter));
    }

    unload(messageCenter) {
      return Promise.resolve()
      .then(() => this._messenger.unload(messageCenter));
    }

    _createId(item) {
      return Promise.resolve(this._id++);
    }

    validate(item) {
      return Promise.resolve()
      .then(() => {
        if ('object' !== typeof(item) || null === item) {
          return Promise.reject(new TypeError('item must be an <Object>.'));
        } else {
          return item;
        }
      });
    }

    create(item) {
      return Promise.resolve()
      .then(() => {
        if (Array.isArray(item)) {
          return Promise.all(item.map((i) => this._create(i)));
        } else {
          return this._create(item);
        }
      })
      .then((result) => {
        this.emit('created', (Array.isArray(result) ? result : [result]));
        return result;
      });
    }

    _create(item) {
      return this.validate(item)
      .then(() => this._createId(item))
      .then((id) => {
        item.id = id;
        this._items.push(item);
        return item;
      });
    }

    count(query) {
      return Promise.resolve(this._items.length);
    }

    list(query, options) {
      return Promise.resolve(this._items);
    }

    get(id) {
      return Promise.resolve()
      .then(() => {
        const item = this._items.find((item) => id === item.id);
        if (item) {
          return item;
        } else {
          return Promise.reject(new Error('item-not-found'));
        }
      });
    }

    update(id, update) {
      return Promise.resolve()
      .then(() => {
        if (Array.isArray(id)) {
          return Promise.all(id.map((i) => this._update(i, update)));
        } else {
          return this._update(id, update);
        }
      })
      .then((result) => {
        this.emit('updated', (Array.isArray(result) ? result : [result]));
        return result;
      });
    }

    _update(id, update) {
      return this.get(id)
      .then((item) => Object.assign(item, update));
    }

    delete(id) {
      return Promise.resolve()
      .then(() => {
        if (Array.isArray(id)) {
          return Promise.all(id.map((i) => this._delete(i)));
        } else {
          return this._delete(id);
        }
      })
      .then((result) => {
        this.emit('deleted', (Array.isArray(result) ? result : [result]));
        return result;
      });
    }

    _delete(id) {
      return this.get(id)
      .then((item) => {
        const index = this._items.indexOf(item);
        this._items.splice(index, 1);
        return item;
      });
    }
  }

  module.exports = CrudManager;
})();
