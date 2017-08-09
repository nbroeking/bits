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
  const chai = require('chai');
  const chaiAsPromised = require('chai-as-promised');
  const KeyManager = require('./../lib/key/key-manager');

  const PUBLIC_KEY_FILEPATH = path.resolve(__dirname, './fixtures/keys/test.pub');

  const expect = chai.expect;

  chai.use(chaiAsPromised);

  class MessageCenter {
    constructor() {
    }

    addRequestListener() {
      return Promise.resolve();
    }
  }

  describe('KeyManager', () => {
    describe('load', () => {
      it('should run', () => {
        const keyManager = new KeyManager();
        return keyManager.load(new MessageCenter());
      });
    });

    describe('getKeyByHash', () => {
      let keyManager = null;

      beforeEach('Create Key manager', () => {
        keyManager = new KeyManager();
      });

      it('should get a key that matches', () => {
        return keyManager.addKeyFromFilepath(PUBLIC_KEY_FILEPATH)
        .then((createdKey) => {
          const foundKey = keyManager.getKeyByHash(createdKey.getHash());
          expect(foundKey).to.equal(createdKey);
        });
      });

      it('should not get a key that has not been added', () => {
        const key = keyManager.getKeyByHash('not a real hash');
        expect(key).to.be.null;
      });
    });

    describe('addKeyFromFilepath', () => {
      let keyManager = null;

      beforeEach('Create Key manager', () => {
        keyManager = new KeyManager();
      });

      it('should add a key to the key manager', () => {
        return keyManager.addKeyFromFilepath(PUBLIC_KEY_FILEPATH)
        .then((createdKey) => {
          const foundKey = keyManager.getKeyByHash(createdKey.getHash());
          expect(foundKey).to.equal(createdKey);
        });
      });

      it('should not add a non-key', () => {
        const filepath = path.resolve(__dirname, __filename);
        return expect(keyManager.addKeyFromFilepath(filepath)).to.be.rejected;
      });

      it('should not add a duplicate key', () => {
        return keyManager.addKeyFromFilepath(PUBLIC_KEY_FILEPATH)
        .then(() => {
          return expect(keyManager.addKeyFromFilepath(PUBLIC_KEY_FILEPATH)).to.be.rejected;
        });
      });
    });

    describe('removeKeyByHash', () => {
      let keyManager = null;
      let createdKey = null;

      beforeEach('Create Key manager', () => {
        keyManager = new KeyManager();
        return keyManager.addKeyFromFilepath(PUBLIC_KEY_FILEPATH)
        .then((key) => {
          createdKey = key;
        });
      });

      it('should remove a key from the key manager', () => {
        return keyManager.removeKeyByHash(createdKey.getHash())
        .then((removedKey) => {
          expect(removedKey).to.equal(createdKey);
        });
      });

      it('should reject if the key does not exist', () => {
        return expect(keyManager.removeKeyByHash('hash does not exist')).to.be.rejected;
      });
    });
  });
})();
