
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

  const pem = require('pem');

  class UtilPem {
    static createPrivateKey(keyBitsize, options) {
      return new Promise((resolve, reject) => {
        pem.createPrivateKey(keyBitsize, options, (err, {key}) => {
          if (err) {
            reject(err);
          } else {
            resolve(key);
          }
        });
      });
    }

    static createCSR(options) {
      return new Promise((resolve, reject) => {
        pem.createCSR(options, (err, {csr}) => {
          if (err) {
            reject(err);
          } else {
            resolve(csr);
          }
        });
      });
    }

    static createCertificate(options) {
      return new Promise((resolve, reject) => {
        pem.createCertificate(options, (err, {certificate}) => {
          if (err) {
            reject(err);
          } else {
            resolve(certificate);
          }
        });
      });
    }

    static verifySigningChain(certificate, ca) {
      return new Promise((resolve, reject) => {
        pem.verifySigningChain(certificate, ca, (err, verify) => {
          if (err) {
            reject(err);
          } else {
            resolve(verify);
          }
        });
      });
    }
  }

  module.exports = UtilPem;
})();
