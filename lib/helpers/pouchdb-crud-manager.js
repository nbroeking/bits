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

  const PouchDB = require('pouchdb');
  PouchDB.plugin(require('pouchdb-find'));
  const CrudManager = require('./crud-manager');

  class PouchDBCrudManager extends CrudManager {
    constructor(tag, path, options) {
      super(tag, options);
      this._path = path;
      this._db = null;
      this._changes = null;
    }

    load(messageCenter) {
      return Promise.resolve()
      .then(() => {
        this._db = new PouchDB(this._path);
        this._changes = this._db.changes({
          since: 'now',
          live: true,
          include_docs: true
        });
        this._changes.on('change', this._change.bind(this));
      })
      .then(() => super.load(messageCenter));
    }

    unload() {
      return Promise.resolve()
      .then(() => super.unload())
      .then(() => this._changes.cancel())
      .then(() => this._db.close())
      .then(() => {
        this._changes = null;
        this._db = null;
      });
    }

    _change(change) {
      const doc = this._sanitizeItem(change.doc);
      if (change.deleted === true) {
        this.emit('deleted', [doc]);
      } else if (/^1\-/.test(doc._rev)) {
        this.emit('created', [doc]);
      } else {
        this.emit('updated', [doc]);
      }
    }

    _createId(item) {
      return Promise.resolve()
      .then(() => super._createId(item))
      .then((id) => `${id}`);
    }

    create(item) {
      return Promise.resolve()
      .then(() => this.validate(item))
      .then(() => this._createId(item))
      .then((id) => this._db.put(Object.assign({_id: id}, item)))
      .then((result) => this._db.get(result.id))
      .then((doc) => this._sanitizeItem(doc));
    }

    count(query) {
      return Promise.resolve()
      .then(() => this.list(query))
      .then((items) => items.length);
    }

    list(query={}, options={}) {
      return Promise.resolve()
      .then(() => this._db.find({
        selector: query,
        fields: options.fields,
        sort: options.sort,
        limit: options.limit,
        skip: options.skip
      }))
      .then((result) => result.docs)
      .then((docs) => docs.map((doc) => this._sanitizeItem(doc)));
    }

    get(id) {
      return Promise.resolve()
      .then(() => this._db.get(id))
      .then((doc) => this._sanitizeItem(doc));
    }

    update(id, update) {
      return Promise.resolve()
      .then(() => this._db.get(id))
      .then((doc) => this._db.put(Object.assign(doc, update)))
      .then((result) => this._db.get(result.id))
      .then((doc) => this._sanitizeItem(doc));
    }

    delete(id) {
      return Promise.resolve()
      .then(() => this._db.get(id))
      .then((doc) => {
        doc._deleted = true;
        return this._db.put(doc)
        .then(() => doc);
      })
      .then((doc) => this._sanitizeItem(doc));
    }

    _sanitizeItem(item) {
      if ('object' === typeof (item) && null !== item) {
        const {_id} = item;
        item.id = _id;
      }
      return item;
    }
  }

  module.exports = PouchDBCrudManager;
})();
