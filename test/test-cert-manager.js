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
  const CertManager = require('../lib/certificate/cert-manager');

  const CERT_FILEPATH = path.resolve(__dirname, './fixtures/certs/test-crt.crt');

  const expect = chai.expect;

  chai.use(chaiAsPromised);

  class MessageCenter {
    constructor() {
    }

    addRequestListener() {
      return Promise.resolve();
    }
  }

  describe('CertManager', () => {
    describe('load', () => {
      it('should run', () => {
        const certManager = new CertManager();
        return certManager.load(new MessageCenter());
      });
    });

    describe('getCertByHash', () => {
      let certManager = null;

      beforeEach('Create Cert manager', () => {
        certManager = new CertManager();
      });

      it('should get a cert that matches', () => {
        return certManager.addCertFromFilepath(CERT_FILEPATH)
        .then((createdCert) => {
          const foundCert = certManager.getCertByHash(createdCert.getHash());
          expect(foundCert).to.equal(createdCert);
        });
      });

      it('should not get a cert that has not been added', () => {
        const cert = certManager.getCertByHash('not a real hash');
        expect(cert).to.be.null;
      });
    });

    describe('addCertFromFilepath', () => {
      let certManager = null;

      beforeEach('Create Cert manager', () => {
        certManager = new CertManager();
      });

      it('should add a cert to the cert manager', () => {
        return certManager.addCertFromFilepath(CERT_FILEPATH)
        .then((createdCert) => {
          const foundCert = certManager.getCertByHash(createdCert.getHash());
          expect(foundCert).to.equal(createdCert);
        });
      });

      it('should not add a duplicate cert', () => {
        return certManager.addCertFromFilepath(CERT_FILEPATH)
        .then(() => {
          return expect(certManager.addCertFromFilepath(CERT_FILEPATH)).to.be.rejected;
        });
      });
    });

    describe('removeCertByHash', () => {
      let certManager = null;
      let createdCert = null;

      beforeEach('Create Cert manager', () => {
        certManager = new CertManager();
        return certManager.addCertFromFilepath(CERT_FILEPATH)
        .then((cert) => {
          createdCert = cert;
        });
      });

      it('should remove a cert from the cert manager', () => {
        return certManager.removeCertByHash(createdCert.getHash())
        .then((removedCert) => {
          expect(removedCert).to.equal(createdCert);
        });
      });

      it('should reject if the cert does not exist', () => {
        return expect(certManager.removeCertByHash('hash does not exist')).to.be.rejected;
      });
    });
  });
})();
