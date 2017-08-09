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
  const UtilFs = require('../helpers/fs');
  const Key = require('../utils/key');
  const KeysMessenger = require('./key-messenger');

  let DEFAULT_BASE = '/tmp';
  let DEFAULT_KEYS_DIR = path.resolve(DEFAULT_BASE, 'tmp');

  if (global.paths && global.paths.data) {
    DEFAULT_BASE = path.resolve(global.paths.data, 'base');
    DEFAULT_KEYS_DIR = path.resolve(DEFAULT_BASE, 'keys');
  }

  class KeyManager {
    constructor(keysDir) {
      this._keys = [];
      this._keysDir = (keysDir ? keysDir : DEFAULT_KEYS_DIR);
      this._messenger = new KeysMessenger(this);
    }

    load(messageCenter) {
      return UtilFs.mkdir(DEFAULT_BASE).catch((err) => {}) // Mkdir if not exists
      .then(() => UtilFs.mkdir(this._keysDir)).catch((err) => {}) // Mkdir if not exists
      .then(() => this._addKeysFromKeysDirectory(this._keysDir))
      .then(() => this._messenger.load(messageCenter));
    }

    _addKeysFromKeysDirectory(keysDir) { // recursively searches directory for keys
      return UtilFs.readdir(keysDir)
      .then((filenames) => {
        return filenames.filter((item) => !(/(^|\/)\.[^\/\.]/g).test(item)); // ignore hidden files
      })
      .then((filenames) => {
        return filenames.reduce((promise, filename) => {
          return promise.then(() => {
            const filepath = path.resolve(keysDir, filename);
            return UtilFs.stat(filepath)
            .then((ret) => {
              if (ret.isDirectory()) {
                return this._addKeysFromKeysDirectory(filepath);
              } else {
                return this.addKeyFromFilepath(filepath);
              }
            });
          })
          .then(null, (err) => {
            // debug('Failed to add key %s: %s', filename, err.toString());
          });
        }, Promise.resolve());
      });
    }

    getKeyByHash(hash) {
      const matches = this._keys.filter((key) => key.getHash() === hash);
      if (0 < matches.length) {
        return matches[0];
      } else {
        return null;
      }
    }

    addKeyFromFilepath(filepath, {copy=false}={}) {
      return Key.fromFile(filepath)
      .then((key) => {
        if (!key.isPublic() && !key.isPrivate()) {
          return Promise.reject(new Error('keys/invalid-key'));
        }
        const dupKey = this.getKeyByHash(key.getHash());
        if (dupKey) {
          return Promise.reject(new Error('keys/duplicate-key'));
        }
        this._keys.push(key);

        if (copy) {
          const filename = path.basename(filepath);
          const dst = path.resolve(this._keysDir, filename);
          return Promise.resolve()
          .then(() => UtilFs.copyFile(filepath, dst))
          .then(() => key.setFilepath(dst))
          .then(() => key);
        } else {
          return key;
        }
      });
    }

    removeKeyByHash(hash) {
      const key = this.getKeyByHash(hash);
      if (!key) {
        return Promise.reject(new Error('keys/key-not-found'));
      }

      const index = this._keys.indexOf(key);
      this._keys.splice(index, 1);
      return Promise.resolve(key);
    }

    getKeyList() {
      return Promise.resolve(this._keys);
    }

    getKeysFromDir(keysDir) { // fucntion is used to get keys from specific dir, return those keys, then return this._keys to be keys from this.keysDir
      return Promise.resolve()
      .then(() => {
        this.clearKeys();
        return this._addKeysFromKeysDirectory(keysDir);
      })
      .then(() => {
        let keys = this._keys;
        this.reloadKeys();
        return Promise.resolve(keys);
      });
    }

    getPrivateKeyList() {
      return this.getKeyList()
      .then((keys) => {
        return keys.filter((key) => {
          return Key.TYPE_PRIVATE === key.type;
        });
      });
    }

    getPublicKeyList() {
      return this.getKeyList()
      .then((keys) => {
        return keys.filter((key) => {
          return Key.TYPE_PUBLIC === key.type;
        });
      });
    }

    getDevicePrivateKey() {
      return this.getPrivateKeyList()
      .then((publicKeys) => {
        const matches = publicKeys.filter((publicKey) => {
          const keyName = path.basename(publicKey.path, Key.EXT_PRIVATE);
          return 'device' === keyName;
        });
        if (0 < matches.length) {
          return matches[0];
        } else {
          return null;
        }
      });
    }

    getBitsSignaturePublicKey() {
      return this.getPublicKeyList()
      .then((publicKeys) => {
        const matches = publicKeys.filter((publicKey) => {
          const keyName = path.basename(publicKey.path, Key.EXT_PUBLIC);
          return 'bits-signature' === keyName;
        });

        if (0 < matches.length) {
          return matches[0];
        } else {
          return null;
        }
      });
    }

    getDefaultPrivateKey() {
      return this.getPrivateKeyList()
      .then((keys) => {
        const defaultKey = keys.find((key) => 'default' === key.getDisplayName());
        if (defaultKey) {
          return defaultKey;
        } else {
          return null;
        }
      });
    }

    reloadKeys() {
      this.clearKeys();
      this._addKeysFromKeysDirectory(this._keysDir);
    }

    clearKeys() {
      this._keys = [];
    }

    create({filepath=null}={}) {
      return this.addKeyFromFilepath(filepath, {copy: true});
    }

    list() {
      return this.getKeyList();
    }

    delete({hash=null}={}) {
      return this.removeKeyByHash(hash)
      .then((key) => UtilFs.unlink(key.getFilepath()));
    }

    static get Key() {
      return Key;
    }

    get Key() {
      return KeyManager.Key;
    }
  }

  module.exports = KeyManager;
})();
