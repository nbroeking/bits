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

  const EXT_PUBLIC = '.pub';
  const EXT_PRIVATE = '.pem';

  const TYPE_PUBLIC = 'public';
  const TYPE_PRIVATE = 'private';
  const TYPE_UNKNOWN = 'unknown';

  class Key {
    constructor(filepath, type, hash) {
      this._filepath = filepath;

      this._type = type;

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

    getType() {
      return this._type;
    }

    getHash() {
      return this._hash;
    }

    isPublic() {
      return UtilCrypto.TYPE_PUBLIC === this.getType();
    }

    isPrivate() {
      return UtilCrypto.TYPE_PRIVATE === this.getType();
    }

    getDisplayName() {
      return path.basename(this.getFilepath(), (this.isPublic() ? EXT_PUBLIC : EXT_PRIVATE));
    }

    getFileName() {
      return path.basename(this.getFilepath());
    }

    get path() {
      return this.getFilepath();
    }

    get type() {
      const extname = path.extname(this.getFilepath());
      if (EXT_PUBLIC === extname || this.isPublic()) {
        return TYPE_PUBLIC;
      } else if (EXT_PRIVATE === extname || this.isPrivate()) {
        return TYPE_PRIVATE;
      } else {
        return TYPE_UNKNOWN;
      }
    }

    static fromFile(filepath) {
      let type = null;
      return Key._calculateType(filepath)
      .then((t) => {
        type = t;
        return UtilCrypto.calculateHashOfFile(filepath);
      })
      .then((hash) => {
        return new Key(filepath, type, hash);
      });
    }

    static _calculateType(filepath) {
      return UtilCrypto.getTypeFromFile(filepath);
    }

    static get TYPE_PUBLIC() {
      return TYPE_PUBLIC;
    }

    static get TYPE_PRIVATE() {
      return TYPE_PRIVATE;
    }

    static get TYPE_UNKNOWN() {
      return TYPE_UNKNOWN;
    }

    static get EXT_PUBLIC() {
      return EXT_PUBLIC;
    }

    static get EXT_PRIVATE() {
      return EXT_PRIVATE;
    }
  }

  if (!global.hasOwnProperty('lib')) {
    global.lib = {};
  }

  global.lib.key = Key;

  module.exports = Key;
})();
