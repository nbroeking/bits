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

  const path = require('path');
  const fs = require('../helpers/fs');
  const PouchDBCrudManager = require('../helpers/pouchdb-crud-manager');
  const ActivityApi = require('./activity-api');
  const ActivityMessenger = require('./activity-messenger');
  const logger = global.LoggerFactory.getLogger();

  class ActivityManager extends PouchDBCrudManager {
    constructor(userManager) {
      const storeBase = path.resolve(global.paths.data, 'base/store/activities');
      const storePath = path.resolve(storeBase, 'activities');
      super(ActivityApi.TAG, storePath, {scopes: ['public'], Messenger: ActivityMessenger});
      this._userManager = userManager;
      this._storeBase = storeBase;
      this._storePath = storePath;
    }

    load(messageCenter) {
      return Promise.resolve()
      .then(() => this._createStorePath())
      .then(() => super.load(messageCenter))
      .then(() => this._db.createIndex({index: {fields: ['dismissed']}}))
      .then(() => this._db.createIndex({index: {fields: ['createdAt']}}))
      .then(() => this._sanitizeDatabase({async: true}));
    }

    _createStorePath() {
      return Promise.resolve()
      .then(() => fs.ensureDirectoryExists(this._storeBase))
      .then(() => fs.ensureDirectoryExists(this._storePath));
    }

    _sanitizeDatabase({skip=0, start=process.hrtime(), async=false}={}) {
      const MAX_CHUNK = 100;
      const chain = Promise.resolve()
      .then(() => this.list({ongoing: true}, {skip: skip, limit: MAX_CHUNK, sort: ['createdAt']}))
      .then((items) => {
        return Promise.all(items.map((item) => this.update(item._id, {ongoing: false})))
        .then(() => {
          if (MAX_CHUNK <= items.length) {
            return this._sanitizeDatabase({skip: skip + MAX_CHUNK, start: start});
          }
          const diff = process.hrtime(start);
          const duration = (diff[0] * 1e9 + diff[1]) / 1e6;
          logger.debug(`Sanitize activities took ${duration.toFixed(2)}ms`);
        });
      });
      if (async) {
        return Promise.resolve();
      }
      return chain;
    }

    _createId(item) {
      return Promise.resolve(`${item.createdAt}`);
    }

    validate(item) {
      return Promise.resolve()
      .then(() => super.validate(item))
      .then(() => {
        if ('object' !== typeof(item) || null === item) {
          return Promise.reject(new Error('activity must be an object'));
        }
        if ('string' !== typeof(item.title)) {
          return Promise.reject(new Error('title must be a string'));
        }
        if ('string' !== typeof(item.projectName)) {
          return Promise.reject(new Error('projectName must be a string'));
        }
      });
    }

    create({title, projectName, icon='icons:build', createdAt=Date.now(), ongoing=false, elementContent, elementImport, data, notify=false, notifyOptions, url}={}) {
      const item = {
        title: title,
        projectName: projectName,
        icon: icon,
        createdAt: createdAt,
        ongoing: ongoing,
        elementContent: elementContent,
        elementImport: elementImport,
        data: data,
        dismissed: false,
        notify: notify,
        notifyOptions: notifyOptions,
        url: url
      };
      return Promise.resolve()
      .then(() => super.create(item));
    }

    list(query, options={}) {
      query = Object.assign({createdAt: {$gte: 0}}, query);
      options = Object.assign({sort: [{createdAt: 'desc'}]}, options);
      return super.list(query, options);
    }

    dismissAll({}={}) {
      return Promise.resolve()
      .then(() => this.list({dismissed: {$eq: false}}, {sort: ['dismissed']}))
      .then((docs) => {
        return this._db.bulkDocs(docs.map((doc) => Object.assign(doc, {dismissed: true})));
      });
    }
  }

  module.exports = ActivityManager;
})();
