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
  const UtilCrypto = require('./../utils/crypto');
  const CERT_EXT = '.crt';

  class Certificate {
    constructor(filepath, hash) {
      this._filepath = filepath;

      if (Buffer.isBuffer(hash)) {
        hash = hash.toString('hex');
      }
      if ('string' !== typeof (hash) || 0 >= hash.length) {
        throw new TypeError('hash must be a non-empty string');
      }
      this._hash = hash;
      this.name = this.getFileName(); // Because we can no longer pass references aroung :/
    }

    getFilepath() {
      return this._filepath;
    }

    setFilepath(filepath) {
      this._filepath = filepath;
    }

    getHash() {
      return this._hash;
    }

    getDisplayName() {
      return path.basename(this.getFilepath(), CERT_EXT);
    }

    getFileName() {
      return path.basename(this.getFilepath());
    }

    get path() {
      return this.getFilepath();
    }

    static fromFile(filepath) {
      return UtilCrypto.calculateHashOfFile(filepath)
      .then((hash) => {
        return new Certificate(filepath, hash);
      });
    }
  }

  if (!global.hasOwnProperty('lib')) {
    global.lib = {};
  }

  global.lib.Certificate = Certificate;

  module.exports = Certificate;
})();
