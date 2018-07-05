/**
Copyright 2018 LGS Innovations

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

  const ScopesUtil = require('./../scopes/scopes-util');

  class CrudApi {
    static get DEFAULT_SCOPES() {
      return null;
    }

    static isValidTag(tag) {
      return 'string' == typeof(tag) && 0 < tag.length;
    }

    constructor(tag, messageCenter, {scopes=CrudApi.DEFAULT_SCOPES}={}) {
      if (!CrudApi.isValidTag(tag)) {
        throw new TypeError('tag must be a non-empty string.');
      }
      this._tag = tag;

      // TODO: Validiate messageCenter
      this._messageCenter = messageCenter;

      if (!ScopesUtil.isValidScopes(scopes)) {
        scopes = CrudApi.DEFAULT_SCOPES;
      }
      this._scopes = scopes;
    }

    /**
     * Add an item to the database, return an object which is the original item
     * plus an 'id' field.  Emits a '* created' event for listeners who care
     * to know when new items are added to the database.
     * @param  {object} item The object to be added to the database, or an array
     *                       of objects to be added.
     * @return {promise}     A promise which resolves to the item (or array of
     *                       items) added.  Note that an 'id' field will have
     *                       been added to each new item.
     */
    create(item) {
      return this._messageCenter.sendRequest(`${this._tag} create`, {scopes: this._scopes}, item);
    }

    /**
     * Return the number of items in the database
     * @param  {string} query Unused
     * @return {number}       The number of items in the database (as a promise)
     */
    count(query) {
      return this._messageCenter.sendRequest(`${this._tag} count`, {scopes: this._scopes}, query);
    }

    /**
     * Return an array of all items in the database
     * @param  {string} query   Unused
     * @param  {string} options Unused
     * @return {array}          An array of all items in the database (as a
     *                          promise)
     */
    list(query, options) {
      return this._messageCenter.sendRequest(`${this._tag} list`, {scopes: this._scopes}, query, options);
    }

    /**
     * Get the item associated with a specified id from the backing store
     * @param  {number} id An id value (from a create call) for a database item
     * @return {object}    The database item, plus an 'id' field (as a promise)
     */
    get(id) {
      return this._messageCenter.sendRequest(`${this._tag} get`, {scopes: this._scopes}, id);
    }

    /**
     * Replace a given item in the database (specified by id) with the supplied
     * new object.  Emits a '* updated' event for listeners who care to know
     * when items are updated in the database.
     * @param  {number} id     An id value or an array of id values (from a
     *                         create call) which reference items in the
     *                         database
     * @param  {object} update The object which will replace the item/items
     *                         which are referenced in the 'id' parameter
     * @return {promise}       A promise which resolves to the updated database
     *                         item/items.  Note that an 'id' field will have
     *                         been added to each new item.
     */
    update(id, update) {
      return this._messageCenter.sendRequest(`${this._tag} update`, {scopes: this._scopes}, id, update);
    }

    /**
     * Remove the item associated with a specified id from the backing store.
     * Emits a '* deleted' event for listeners who care to know when items are
     * removed from the database.
     * @param  {number} id An id value or an array of id values (from a create
     *                     call) which reference items in the database
     * @return {promise}   A promise which resolves to the item (or items) that
     *                     was removed from the database.  Note that an 'id'
     *                     field will have been added to each new item.
     */
    delete(id) {
      return this._messageCenter.sendRequest(`${this._tag} delete`, {scopes: this._scopes}, id);
    }

    /**
     * Add a listener for this object's '* created' event
     * @param {function} listener A function to be executed when new items are
     *                            added to the database. The listener is passed
     *                            a single parameter which is *an array* of
     *                            items which have been added to the database.
     * @return {promise}          returns an empty promise
     */
    addCreatedListener(listener) {
      return this._messageCenter.addEventListener(`${this._tag} created`, this._scopes, listener);
    }

    /**
     * Removes a listener for this object's '* created' event
     * @param {function} listener The same listener that was passed in the
     *                            'addCreatedListener' method.
     * @return {promise}          returns an empty promise
     */
    removeCreatedListener(listener) {
      return this._messageCenter.removeEventListener(`${this._tag} created`, this._scopes, listener);
    }

    /**
     * Add a listener for this object's '* updated' event
     * @param {function} listener A function to be executed when items are
     *                            changed in the database. The listener is
     *                            passed a single parameter which is *an array*
     *                            of items which have been updated in the
     *                            database.
     * @return {promise}          returns an empty promise
     */
    addUpdatedListener(listener) {
      return this._messageCenter.addEventListener(`${this._tag} updated`, this._scopes, listener);
    }

    /**
     * Removes a listener for this object's '* updated' event
     * @param {function} listener The same listener that was passed in the
     *                            'addUpdatedListener' method.
     * @return {promise}          returns an empty promise
     */
    removeUpdatedListener(listener) {
      return this._messageCenter.removeEventListener(`${this._tag} updated`, this._scopes, listener);
    }

    /**
     * Add a listener for this object's '* deleted' event
     * @param {function} listener A function to be executed when items are
     *                            removed from the database. The listener is
     *                            passed a single parameter which is *an array*
     *                            of items that have been removed from the
     *                            database.
     * @return {promise}          returns an empty promise
     */
    addDeletedListener(listener) {
      return this._messageCenter.addEventListener(`${this._tag} deleted`, this._scopes, listener);
    }

    /**
     * Removes a listener for this object's '* deleted' event
     * @param {function} listener The same listener that was passed in the
     *                            'addDeletedListener' method.
     * @return {promise}          returns an empty promise
     */
    removeDeletedListener(listener) {
      return this._messageCenter.removeEventListener(`${this._tag} deleted`, this._scopes, listener);
    }
  }

  module.exports = CrudApi;
})();
