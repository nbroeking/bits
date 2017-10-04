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

  const CrudMessenger = require('./../helpers/crud-messenger');

  class OmgsMessenger extends CrudMessenger {
    static get TAG() {
      return 'base#Omgs';
    }

    static get READ_SCOPES() {
      return ['public'];
    }

    static get WRITE_SCOPES() {
      return ['base'];
    }

    static get REQUEST() {
      return {
        LOAD: `${OmgsMessenger.TAG} load`,
        ADD: `${OmgsMessenger.TAG} add`,
        CURRENT_GET: `${OmgsMessenger.TAG} currentGet`
      };
    }

    static sanitizeOmg(items) {
      if (Array.isArray(items)) {
        return Promise.all(items.map((item) => OmgsMessenger._sanitizeOmg(item)));
      } else {
        return OmgsMessenger._sanitizeOmg(items);
      }
    }

    static _sanitizeOmg(item) {
      if (item) {
        return {
          id: item.id,
          state: item.state,
          data: item.data
        };
      } else {
        return null;
      }
    }

    constructor(manager) {
      super(OmgsMessenger.TAG, manager, {readScopes: OmgsMessenger.READ_SCOPES, writeScopes: OmgsMessenger.WRITE_SCOPES});
      this.addRequestListener(OmgsMessenger.REQUEST.LOAD, OmgsMessenger.WRITE_SCOPES, this._load.bind(this));
      this.addRequestListener(OmgsMessenger.REQUEST.ADD, OmgsMessenger.WRITE_SCOPES, this._add.bind(this));
      this.addRequestListener(OmgsMessenger.REQUEST.CURRENT_GET, OmgsMessenger.READ_SCOPES, this._currentGet.bind(this));
    }

    _create() {
      return Promise.reject(new Error('not implemented'));
    }

    _list() {
      return super._list()
      .then((items) => items.map(OmgsMessenger.sanitizeOmg));
    }

    _get(metadata, id) {
      return super._get(metadata, id)
      .then(OmgsMessenger.sanitizeOmg);
    }

    _currentGet() {
      return this._manager.getCurrentOmgInfo()
      .then(OmgsMessenger.sanitizeOmg);
    }

    _update() {
      return Promise.reject(new Error('not implemented'));
    }

    _delete(metadata, id) {
      return super._delete(metadata, id)
      .then(OmgsMessenger.sanitizeOmg);
    }

    _updated(items) {
      super._updated(OmgsMessenger.sanitizeOmg(items));
    }

    _deleted(items) {
      super._deleted(OmgsMessenger.sanitizeOmg(items));
    }

    _load(metadata, id) {
      return this._manager.loadOmg(id);
    }

    _add(metadata, request) {
      return this._manager.add(request);
    }
  }

  module.exports = OmgsMessenger;
})();
