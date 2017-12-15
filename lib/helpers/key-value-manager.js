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

  class KeyValueManager extends EventEmitter {
    constructor() {
      super();
      this._store = new Map();
    }

    set({key, value}) {
      return Promise.resolve()
      .then(() => {
        this._store.set(key, value);
        this.emit('set', {key: key, value: value});
      });
    }

    get({key}) {
      return Promise.resolve()
      .then(() => {
        const exists = this._store.has(key);
        if (exists) {
          return this._store.get(key);
        } else {
          return Promise.reject(new Error(`key not found: ${key}`));
        }
      });
    }

    has({key}) {
      return Promise.resolve(this._store.has(key));
    }

    delete({key}) {
      return Promise.resolve()
      .then(() => {
        const exists = this._store.has(key);
        if (exists) {
          this._store.delete(key);
          this.emit('delete', {key: key});
        } else {
          return Promise.reject(new Error(`key not found: ${key}`));
        }
      });
    }

    clear() {
      return Promise.resolve()
      .then(() => {
        this._store.clear();
        this.emit('clear');
      });
    }

    keys() {
      return Promise.resolve(Array.from(this._store.keys()));
    }

    values() {
      return Promise.resolve(Array.from(this._store.values()));
    }
  }

  module.exports = KeyValueManager;
})();
