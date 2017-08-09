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

  const ScopesApi = require('./scopes-api');
  const CrudMessenger = require('./../helpers/crud-messenger');

  class ScopesMessenger extends CrudMessenger {
    constructor(manager) {
      super(ScopesApi.TAG, manager, {readScopes: ['public'], writeScopes: null});
    }

    update() {
      return Promise.reject(new Error('not implemented'));
    }

    delete() {
      return Promise.reject(new Error('not implemented'));
    }
  }

  module.exports = ScopesMessenger;
})();
