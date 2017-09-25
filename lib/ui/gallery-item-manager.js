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
          let visible = false;
          value.scopes.forEach((scope) => {
            visible = visible || metadata.scopes.some((val) => {
              return val === scope;
            });
          });
          return visible;
        });
      });
    }

    updateFilter(user, items) {
      const userScopes = user.scopes.map((scope) => scope.name);

      const visible = items.reduce((vis, item) => {
        vis = item.scopes.reduce((scopesVis, scope) => {
          scopesVis = scopesVis || userScopes.includes(scope);
          return scopesVis;
        }, false);
        return vis;
      }, false);

      if (visible) {
        return Promise.resolve(items);
      } else {
        const error = new Error('filter/failed');
        error.reason = 'failed';
        return Promise.reject(error);
      }
    }
  }

  module.exports = GalleryItemManager;
})();
