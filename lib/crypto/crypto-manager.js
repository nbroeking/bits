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
  const fs = require('fs');
  const Key = require('../utils/key');
  const UtilFs = require('../helpers/fs');
  const CryptoMessenger = require('./crypto-messenger');
  const {Encrypter, Decrypter} = require('@skidder/bits-crypto');

  class CryptoManager {
    constructor(keyManager) {
      this._keyManager = keyManager;
      this._messenger = new CryptoMessenger(this);
    }

    load(messageCenter) {
      return Promise.resolve()
      .then(() => this._messenger.load(messageCenter));
    }

    unload() {
      return Promise.resolve()
      .then(() => this._messenger.unload());
    }

    decryptFileWithKey(filepath, outdir, encryptionKeyHash, signatureKeyHash) {
      return this.decryptFileWithKeyAndOffset(filepath, outdir, encryptionKeyHash, signatureKeyHash, 0);
    }

    decryptFileWithKeyAndOffset(filepath, outdir, encryptionKeyHash, signatureKeyHash, offset) {
      let encryptionKey = this._keyManager.getKeyByHash(encryptionKeyHash);
      if (!encryptionKey) {
        return Promise.reject(new Error('Encryption key not found'));
      } else if (!encryptionKey.isPrivate()) {
        return Promise.reject(new Error('Encryption key must be a private key'));
      }

      let signatureKey = (signatureKeyHash ? this._keyManager.getKeyByHash(signatureKeyHash) : this._keyManager.getBitsSignaturePublicKey());
      if (!signatureKey) {
        return Promise.reject(new Error('Signature key not found'));
      } else if (!signatureKey.isPublic()) {
        return Promise.reject(new Error('Signature key must be a public key'));
      }

      return this._runDecryptFileScript(filepath, offset, outdir, encryptionKey.path, signatureKey.path);
    }

    decryptFile(filepath, outdir, options) {
      return this.decryptFileWithOffset(filepath, 0, outdir, options);
    }

    decryptFileWithOffset(filepath, offset, outdir, options) {
      let signatureKeyFilepath = null;
      options = options || {};
      return this._keyManager.getBitsSignaturePublicKey()
      .then((bitsSignatureKey) => {
        const signatureKey = options.signatureKey || bitsSignatureKey;
        if (!signatureKey) {
          return Promise.reject(new Error('No signature key provided'));
        }
        signatureKeyFilepath = signatureKey.path;
        return this._keyManager.getPrivateKeyList();
      })
      .then((privateKeys) => {
        return privateKeys.reduce((chain, encryptionKey) => {
          return chain.catch((err) => {
            const encryptionKeyFilepath = encryptionKey.path;
            return this._runDecryptFileScript(filepath, offset, outdir, encryptionKeyFilepath, signatureKeyFilepath);
          });
        }, Promise.reject(new Error('No private keys')));
      });
    }

    _runDecryptFileScript(filepath, offset, outdir, encryptionKeyPath, signatureKeyPath) {
      const extname = path.extname(filepath);
      const filename = path.basename(filepath, extname);
      const decryptedFilepath = path.join(outdir, `${filename}.file`);
      return Promise.resolve()
      .then(() => Promise.all([
        UtilFs.readFile(encryptionKeyPath),
        UtilFs.readFile(signatureKeyPath),
      ]))
      .then(([encryptionKey, signatureKey]) => {
        if (!Number.isInteger(offset)) {
          offset = 0;
        }
        const input = fs.createReadStream(filepath, {start: offset});
        const output = fs.createWriteStream(decryptedFilepath);
        const options = {
          input: input,
          output: output,
          encryptionKey: encryptionKey,
          signatureKey: signatureKey,
        };
        const decrypter = new Decrypter();
        return decrypter.decrypt(options);
      })
      .then(({filename}) => {
        const outputFilepath = path.join(outdir, filename);
        return Promise.resolve()
        .then(() => UtilFs.rename(decryptedFilepath, outputFilepath))
        .then(() => outputFilepath);
      });
    }

    encryptFile(filepath, encryptionKey, signatureKey, outdir) {
      if (!(encryptionKey instanceof Key) || !encryptionKey.isPublic()) {
        return Promise.reject(new Error('encryption key must be a public key.'));
      }
      if (!(signatureKey instanceof Key) || !signatureKey.isPrivate()) {
        return Promise.reject(new Error('signature key key must be a private key.'));
      }
      const filename = path.basename(filepath);
      let outputFilepath = null;
      let output = null;
      let headerEnd = 0;
      return Promise.resolve()
      .then(() => UtilFs.stat(outdir))
      .then((stats) => {
        if (!stats.isDirectory()) {
          return Promise.reject(new TypeError('outdir is not a directory.'));
        }
        const extname = path.extname(filepath);
        const filenameWithoutExt = path.basename(filename, extname);
        outputFilepath = path.join(outdir, `${filenameWithoutExt}.enc`);
        output = fs.createWriteStream(outputFilepath);
      })
      .then(() => {
        const headerData = {
          encKey: encryptionKey.getHash(),
          sigKey: signatureKey.getHash(),
        };
        const header = Buffer.from(JSON.stringify(headerData));
        const headerInfo = Buffer.from(`${header.length}#`);
        output.write(headerInfo);
        output.write(header);
        headerEnd = headerInfo.length + header.length;
      })
      .then(() => Promise.all([
        UtilFs.readFile(encryptionKey.getFilepath()),
        UtilFs.readFile(signatureKey.getFilepath()),
      ]))
      .then(([encryptionKey, signatureKey]) => {
        const input = fs.createReadStream(filepath);
        const options = {
          input: input,
          output: output,
          encryptionKey: encryptionKey,
          signatureKey: signatureKey,
          filename: filename,
        };
        const encrypter = new Encrypter();
        return encrypter.encrypt(options);
      })
      .then((signature) => this._writeSignature({
        signature: signature,
        outputFilepath: outputFilepath,
        headerEnd: headerEnd
      }))
      .then(() => outputFilepath);
    }

    _writeSignature({outputFilepath, signature, headerEnd=0}={}) {
      return new Promise((resolve, reject) => {
        const output = fs.createWriteStream(outputFilepath, {start: headerEnd, flags: 'r+'});
        function onError(err) {
          output.removeListener('finish', onFinish);
          reject(err);
        }
        function onFinish() {
          output.removeListener('error', reject);
          resolve();
        }
        output.once('error', onError);
        output.once('finish', onFinish);
        output.write(signature);
        output.end();
      });
    }

    encryptFileWithAvailableKeys(filepath, outdir) {
      let encryptionKey = null;
      let signatureKey = null;

      return this.getAvailableEncryptionKey()
      .then((key) => {
        encryptionKey = key;
        return this.getAvailableSignatureKey();
      })
      .then((key) => {
        signatureKey = key;
        return this.encryptFile(filepath, encryptionKey, signatureKey, outdir);
      })
      .then((filepath) => {
        return {
          signatureKey: signatureKey,
          encryptionKey: encryptionKey,
          filepath: filepath
        };
      });
    }

    getAvailableEncryptionKey() {
      return this._keyManager.getBitsSignaturePublicKey()
      .then((keys) => {
        if (null === keys) {
          return this._keyManager.getPublicKeyList()
          .then((keys) => {
            if (0 < keys.length) {
              return keys[0];
            } else {
              return null;
            }
          });
        } else {
          return keys;
        }
      })
      .then((key) => {
        if (null === key) {
          return Promise.reject(new Error('No available public key to encrypt data.'));
        } else {
          return key;
        }
      });
    }

    getAvailableSignatureKey() {
      return Promise.resolve()
      .then(() => this._keyManager.getDefaultPrivateKey())
      .then((key) => {
        if (null === key) {
          return Promise.resolve()
          .then(() => this._keyManager.getPrivateKeyList())
          .then((keys) => keys.filter((key) => 'device' !== key.getFileName()))
          .then((keys) => {
            if (0 < keys.length) {
              return keys[0];
            } else {
              return null;
            }
          });
        } else {
          return key;
        }
      })
      .then((key) => {
        if (null === key) {
          return Promise.reject(new Error('No available private key to sign data.'));
        } else {
          return key;
        }
      });
    }

    getKeyByHash(hash) {
      return this._keyManager.getKeyByHash(hash);
    }
  }
  module.exports = CryptoManager;
})();
