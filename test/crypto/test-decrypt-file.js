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
  const DecryptFile = require('./../../crypto/decrypt-file');

  const FILEPATH = path.resolve(__dirname, './../fixtures/modules-packages/a-1.0.0.test-signed.mod');
  const ENCRYPTION_KEY_FILEPATH = path.resolve(__dirname, './../fixtures/keys/test.pem');
  const SIGNATURE_KEY_FILEPATH = path.resolve(__dirname, './../fixtures/keys/test-signature.pub');

  const SIGNATURE_KEY = `-----BEGIN PUBLIC KEY-----
MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEArR9Xh0m6lenyapQrCebY
9l75nvz8dDODP17anpROVxW/tVzmQ9X0Z1lC4K6e806rrdbHleUutot2pygpZssD
imM78M6fA/cC7TDw0FX8EjuJece8z9QBbGCc2+fA3rqsWeStJTfzvZoFo02Lz92i
yQO0m9oN2jriu2qhx3njAaQEDlofdQtJQonKNDXYmDOBoV35eFrdzaOxUyV5NE1d
YbfW23J+gSmgCtkRVygxf9IevFis+USbo3/xx+yyhqEOeFwxDjOAlroqwU21yxux
5PueWw+bUYEFGIvTL5C1wCijc2o4+VTuwUwJhkV4ImylNMHy+ECoPnxZcBSUm5J7
op1APZ+RhtTushKLIb+qA4SNyLbzgvcX07L2XVZMdypWJ4AbkCp19vR4JPnNGC0D
54fHtBNWGTVszkTV7tPbGhfLH7mICWcpevWMGZaALY1QD2q4MIeZ7HhTsvYIxtJW
lS0SryasLJJ6bF9LulGsp5cmkzubzBz0/y6g1iNsBxVquPheJHKjqinXVRaRfmNN
kxFiQiwKdS+7S2BJe+z+Wk9qyrCUwPkMIRs9/M3ioJyzZTQYDJOJwuCC9ze3kldq
EN/qQqPHFzU5H99MvPDQ4fRxhiO7rdXuJAQ1GGBW0Ho/YUlArO5rERxM0+UXqIyx
a1+wf7fvrjJagA5XVjuPXNsCAwEAAQ==
-----END PUBLIC KEY-----`;

  const SIGNATURE_KEY_BUFFER = new Buffer(SIGNATURE_KEY, 'utf8');

  const expect = chai.expect;

  chai.use(chaiAsPromised);

  describe('DecryptFile', () => {
    describe('decrypt', () => {
      it('should run with signature key filepath', () => {
        const decryptFile = new DecryptFile(FILEPATH);
        return decryptFile.decrypt(ENCRYPTION_KEY_FILEPATH, SIGNATURE_KEY_FILEPATH);
      });

      it('should run with signature key', () => {
        const decryptFile = new DecryptFile(FILEPATH);
        return decryptFile.decrypt(ENCRYPTION_KEY_FILEPATH, SIGNATURE_KEY);
      });

      it('should run with signature key buffer', () => {
        const decryptFile = new DecryptFile(FILEPATH);
        return decryptFile.decrypt(ENCRYPTION_KEY_FILEPATH, SIGNATURE_KEY_BUFFER);
      });

      it('should reject if signature is invalid', () => {
        const decryptFile = new DecryptFile(FILEPATH);
        const invalidSignature = new Buffer(512);
        return expect(decryptFile.decrypt(ENCRYPTION_KEY_FILEPATH, invalidSignature)).to.be.rejected;
      });
    });
  });
})();
