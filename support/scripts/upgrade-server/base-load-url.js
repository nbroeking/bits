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

  // This file can be used in both the upgrade server and in BITS itself, so
  // we need to set a logger depending on what we can find
  let simpleLogger = null;
  let bitsLogger = null;
  try {
    simpleLogger = require('./simple-logger');
  } catch (ex) {}
  try {
    bitsLogger = require('../logging/logger-factory').getLogger();
  } catch (ex) {}
  const logger = (simpleLogger != null) ? simpleLogger : bitsLogger;

  const BASE_LOAD_URL_PREFIX = 'base#LoadUrl ';
  const BASE_LOAD_URL = {
    REQUEST: {
      URL_GET: BASE_LOAD_URL_PREFIX + 'urlGet',
      URL_SET: BASE_LOAD_URL_PREFIX + 'urlSet',
      IDENTITY_GET: BASE_LOAD_URL_PREFIX + 'identityGet',
      IDENTITY_SET: BASE_LOAD_URL_PREFIX + 'identitySet',
    },
    EVENT: {
      URL_UPDATED: BASE_LOAD_URL_PREFIX + 'urlUpdated',
      IDENTITY_UPDATED: BASE_LOAD_URL_PREFIX + 'identityUpdated',
    },
  };

  const __idCharset = '01234567890' // numbers
    + 'abcdefghijklmnopqrstuvwxyz' // lower case
    + 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' // upper case
    + '~@#$%^&' // symbols
    + '\'"`' // quotation marks
    + '[]{}()<>' // brackets
    + '*/-=+' // math
    + ';:,.!?'; // punctuation

  class BaseLoadUrl {
    constructor() {
      this._url = null;
      this._identity = null;
      this._messageCenter = null;
    }

    load(baseIdentity, messageCenter) {
      this._identity = baseIdentity + '_' + this._generateId(32);
      this._messageCenter = messageCenter;
      return Promise.resolve()
      // establish listeners
      .then(() => logger.silly('BaseLoadUrl | ++load (ID = "' + this._identity + '")'))
      .then(() => this._messageCenter.addRequestListener( // listen for "give me the current URL"
        BASE_LOAD_URL.REQUEST.URL_GET,
        {scopes: ['public']},
        this._getUrl.bind(this)))
      .catch((err) => logger.error('BaseLoadUrl | URL REQUEST LISTENER: ERROR: ', err))
      .then(() => this._messageCenter.addRequestListener( // listen for "set the current URL"
        BASE_LOAD_URL.REQUEST.URL_SET,
        {scopes: ['public']},
        this._setUrl.bind(this)))
      .catch((err) => logger.error('BaseLoadUrl | URL EVENT: ERROR: ', err))
      .then(() => this._messageCenter.addRequestListener( // listen for "give me the current identity"
        BASE_LOAD_URL.REQUEST.IDENTITY_GET,
        {scopes: ['public']},
        this._getIdentity.bind(this)))
      .catch((err) => logger.error('BaseLoadUrl | IDENTITY REQUEST LISTENER: ERROR: ', err))
      .then(() => this._messageCenter.addRequestListener( // listen for "set the current identity"
        BASE_LOAD_URL.REQUEST.IDENTITY_SET,
        {scopes: ['public']},
        this._setIdentity.bind(this)))
      .catch((err) => logger.error('BaseLoadUrl | IDENTITY EVENT: ERROR: ', err))
      // broadcast current identity and URL (as if they'd changed)
      .then(() => this._messageCenter.sendEvent(BASE_LOAD_URL.EVENT.URL_UPDATED, {scopes: ['public']}, this._url))
      .catch((err) => logger.error('BaseLoadUrl | UPDATE URL: ERROR: ', err))
      .then(() => this._messageCenter.sendEvent(BASE_LOAD_URL.EVENT.IDENTITY_UPDATED, {scopes: ['public']}, this._identity))
      .catch((err) => logger.error('BaseLoadUrl | UPDATE IDENTITY: ERROR: ', err))
      .then(() => logger.silly('BaseLoadUrl | --load'));
    }

    _getUrl() {
      logger.silly('BaseLoadUrl | _getUrl returns ' + this._url);
      return this._url;
    }

    _setUrl(metadata, newUrl) {
      logger.silly('BaseLoadUrl | _setUrl(new = ' + newUrl + ', prev = ' + this._url + ')');
      if (this._url != newUrl) {
        this._url = newUrl;
        // let listeners know the URL has been updated
        this._messageCenter.sendEvent(BASE_LOAD_URL.EVENT.URL_UPDATED, {scopes: ['public']}, this._url);
      }
    }

    _getIdentity() {
      logger.silly('BaseLoadUrl | _getIdentity returns ' + this._identity);
      return this._identity;
    }

    _setIdentity(metadata, newIdentity) {
      logger.silly('BaseLoadUrl | _setIdentity(new = ' + newIdentity + ', prev = ' + this._identity + ')');
      if (this._identity != newIdentity) {
        this._identity = newIdentity;
        // let listeners know the identity has been updated
        this._messageCenter.sendEvent(BASE_LOAD_URL.EVENT.IDENTITY_UPDATED, {scopes: ['public']}, this._identity);
      }
    }

    unload() {
      return Promise.resolve()
      .then(() => logger.silly('BaseLoadUrl | ++unload'))
      .then(() => this._messageCenter.removeRequestListener(
        BASE_LOAD_URL.REQUEST.URL_GET,
        this._getUrl.bind(this)))
      .catch((err) => logger.error('BaseLoadUrl | URL REQUEST LISTENER: ERROR: ', err))
      .then(() => this._messageCenter.removeRequestListener(
        BASE_LOAD_URL.REQUEST.URL_SET,
        this._setUrl.bind(this)))
      .catch((err) => logger.error('BaseLoadUrl | URL EVENT: ERROR: ', err))
      .then(() => this._messageCenter.removeRequestListener(
        BASE_LOAD_URL.REQUEST.IDENTITY_GET,
        this._getIdentity.bind(this)))
      .catch((err) => logger.error('BaseLoadUrl | IDENTITY REQUEST LISTENER: ERROR: ', err))
      .then(() => this._messageCenter.removeRequestListener(
        BASE_LOAD_URL.REQUEST.IDENTITY_SET,
        this._setIdentity.bind(this)))
      .catch((err) => logger.error('BaseLoadUrl | IDENTITY EVENT: ERROR: ', err))
      .then(() => {
        this._messageCenter = null;
      })
      .then(() => logger.silly('BaseLoadUrl | --unload'));
    }

    _generateId(numChars) {
      let id = '';
      for (let i = 0; i < numChars; i++) {
        id += __idCharset.charAt(Math.floor(Math.random() * __idCharset.length));
      }
      return id;
    }
  }

  module.exports = BaseLoadUrl;
})();
