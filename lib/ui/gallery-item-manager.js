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

  const CrudManager = require('../helpers/crud-manager');

  class GalleryItemManager extends CrudManager {
    constructor() {
      super('base#GalleryItems', {readScopes: ['public'], writeScopes: null, Messenger: require('./gallery-item-messenger')});
    }

    create(item) {
      if ('string' === typeof(item.category)) {
        item.category = item.category.toLowerCase();
      }
      return super.create(item);
    }

    list(metadata) {
      return super.list()
      .then((values) => {
        if (!values) {
          return [];
        }
        return values.filter((value) => {
          let visable = false;
          value.scopes.forEach((scope) => {
            visable = visable || metadata.scopes.some((val) => {
              return val === scope;
            });
          });
          return visable;
        });
      });
    }

    updateFilter(user, item) {
      let visable = false;
      const userScopes = user.scopes.map((scope) => scope.name);

      item.scopes.forEach((scope) => {
        visable = visable || userScopes.some((val) => {
          return val === scope;
        });
      });

      if (visable) {
        return Promise.resolve(item);
      } else {
        const error = new Error('filter/failed');
        error.reason = 'failed';
        return Promise.reject(error);
      }
    }
  }

  module.exports = GalleryItemManager;
})();
