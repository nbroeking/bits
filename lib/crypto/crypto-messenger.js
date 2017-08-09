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

  const CrypoApi = require('./crypto-api');
  const Messenger = require('./../helpers/messenger');

  class CryptoMessenger extends Messenger {
    constructor(manager) {
      super();
      this._manager = manager;
      this.addRequestListener(CrypoApi.REQUEST.DECRYPT_FILE, {scopes: CrypoApi.SCOPES}, this._decryptFile.bind(this));
      this.addRequestListener(CrypoApi.REQUEST.DECRYPT_FILE_WITH_KEY, {scopes: CrypoApi.SCOPES}, this._decryptFileWithKey.bind(this));
      this.addRequestListener(CrypoApi.REQUEST.ENCRYPT_FILE, {scopes: CrypoApi.SCOPES}, this._encryptFile.bind(this));
      this.addRequestListener(CrypoApi.REQUEST.ENCRYPT_FILE_WITH_AVAILABLE_KEYS, {scopes: CrypoApi.SCOPES}, this._encryptFileWithAvailableKeys.bind(this));
    }

    _decryptFile(metadata, {filepath=null, offset=0, outdir=null, options=null}={}) {
      return this._manager.decryptFileWithOffset(filepath, offset, outdir, options);
    }

    _decryptFileWithKey(metadata, {filepath=null, outdir=null, encKeyHash=null, sigKeyHash=null, offset=0}={}) {
      return this._manager.decryptFileWithKeyAndOffset(filepath, outdir, encKeyHash, sigKeyHash, offset);
    }

    _encryptFile(metadata, {filepath=null, encryptionKeyHash=null, signatureKeyHash=null, outdir=null}={}) {
      const info = {};
      return Promise.resolve()
      .then(() => this._manager.getKeyByHash(encryptionKeyHash))
      .then((key) => {
        info.encryptionKey = key;
      })
      .then(() => this._manager.getKeyByHash(signatureKeyHash))
      .then((key) => {
        info.signatureKey = key;
      })
      .then(() => this._manager.encryptFile(filepath, info.encryptionKey, info.signatureKey, outdir));
    }

    _encryptFileWithAvailableKeys(metadata, {filepath=null, outdir=null}={}) {
      return this._manager.encryptFileWithAvailableKeys(filepath, outdir);
    }
  }

  module.exports = CryptoMessenger;
})();
