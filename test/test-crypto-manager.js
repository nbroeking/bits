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

  const os = require('os');
  const path = require('path');
  const chai = require('chai');
  const chaiAsPromised = require('chai-as-promised');
  const UtilFs = require('./../lib/helpers/fs');
  const KeyManager = require('./../lib/key/key-manager');
  const CryptoManager = require('./../lib/crypto/crypto-manager');

  const BITS_SIGNATURE_KEY_FILEPATH = path.resolve(__dirname, './fixtures/keys/bits-signature.pub');
  const TEST_SIGNATURE_KEY_FILEPATH = path.resolve(__dirname, './fixtures/keys/test-signature.pub');
  const PRIVATE_KEY_FILEPATH = path.resolve(__dirname, './fixtures/keys/test.pem');
  const MODULE_PACKAGE_BITS_SIGNED_FILEPATH = path.resolve(__dirname, './fixtures/modules-packages/a-1.0.0.bits-signed.mod');
  const MODULE_PACKAGE_TEST_SIGNED_FILEPATH = path.resolve(__dirname, './fixtures/modules-packages/a-1.0.0.test-signed.mod');
  const MODULE_PACKAGE_FILEPATH = path.resolve(__dirname, './fixtures/modules-packages/a-1.0.0.tgz');

  const expect = chai.expect;

  chai.use(chaiAsPromised);

  describe('CryptoManager', () => {
    describe('decryptFile', () => {
      let keyManager = null;
      let cryptoManager = null;

      beforeEach('Create crypto manager', () => {
        keyManager = new KeyManager();
        cryptoManager = new CryptoManager(keyManager);
        return Promise.resolve(cryptoManager);
      });

      it('should reject with when no bits-signature key', () => {
        return expect(cryptoManager.decryptFile(MODULE_PACKAGE_BITS_SIGNED_FILEPATH, os.tmpdir())).to.be.rejectedWith('No signature key provided');
      });

      it('should reject when no private keys exist', () => {
        return keyManager.addKeyFromFilepath(BITS_SIGNATURE_KEY_FILEPATH)
        .then(() => {
          return expect(cryptoManager.decryptFile(MODULE_PACKAGE_BITS_SIGNED_FILEPATH, os.tmpdir())).to.be.rejectedWith('No private keys');
        });
      });

      it('should decrypt file when bits key and private key are added to key manager', () => {
        return keyManager.addKeyFromFilepath(BITS_SIGNATURE_KEY_FILEPATH)
        .then(() => {
          return keyManager.addKeyFromFilepath(PRIVATE_KEY_FILEPATH);
        })
        .then(() => {
          return cryptoManager.decryptFile(MODULE_PACKAGE_BITS_SIGNED_FILEPATH, os.tmpdir());
        })
        .then((filepath) => {
          return UtilFs.unlink(filepath);
        });
      });

      it('should decrypt file when optional signature key is used', () => {
        return keyManager.addKeyFromFilepath(PRIVATE_KEY_FILEPATH)
        .then(() => keyManager.addKeyFromFilepath(TEST_SIGNATURE_KEY_FILEPATH))
        .then((testSignatureKey) => {
          const options = {
            signatureKey: testSignatureKey
          };
          return cryptoManager.decryptFile(MODULE_PACKAGE_TEST_SIGNED_FILEPATH, os.tmpdir(), options);
        })
        .then((filepath) => UtilFs.unlink(filepath));
      });
    });

    describe('encryptFile', () => {
      let keyManager = null;
      let cryptoManager = null;
      let publicKey = null;
      let privateKey = null;

      beforeEach('Create crypto manager', () => {
        keyManager = new KeyManager();

        return keyManager.addKeyFromFilepath(BITS_SIGNATURE_KEY_FILEPATH)
        .then((key) => {
          publicKey = key;

          return keyManager.addKeyFromFilepath(PRIVATE_KEY_FILEPATH);
        })
        .then((key) => {
          privateKey = key;
          cryptoManager = new CryptoManager(keyManager);
          return cryptoManager;
        });
      });

      it('should reject if no encryption key', () => {
        return expect(cryptoManager.encryptFile(MODULE_PACKAGE_FILEPATH)).to.be.rejected;
      });

      it('should reject if encryption key is not a public key', () => {
        return expect(cryptoManager.encryptFile(MODULE_PACKAGE_FILEPATH, privateKey)).to.be.rejected;
      });

      it('should reject if no signature key', () => {
        return expect(cryptoManager.encryptFile(MODULE_PACKAGE_FILEPATH, publicKey)).to.be.rejected;
      });

      it('should reject if signature key is not a private key', () => {
        return expect(cryptoManager.encryptFile(MODULE_PACKAGE_FILEPATH, publicKey, publicKey)).to.be.rejected;
      });

      it('should reject if no output directory', () => {
        return expect(cryptoManager.encryptFile(MODULE_PACKAGE_FILEPATH, publicKey, privateKey)).to.be.rejected;
      });

      it('should resolve if all parameters are ok?!', () => {
        return cryptoManager.encryptFile(MODULE_PACKAGE_FILEPATH, publicKey, privateKey, os.tmpdir())
        .then((filepath) => {
          return UtilFs.unlink(filepath);
        });
      });
    });
  });
})();
