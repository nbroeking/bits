
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
(function() {
  'use strict';

  let pem = require('pem');

  module.exports = {
    createPrivateKey: function(keyBitsize, options) {
      return new Promise(function(fulfill, reject) {
        pem.createPrivateKey(keyBitsize, options, function(err, keyData) {
          if (err) {
            reject(err);
          } else {
            fulfill(keyData.key);
          }
        });
      });
    },

    createCSR: function(options) {
      return new Promise(function(fulfill, reject) {
        pem.createCSR(options, function(err, csrData) {
          if (err) {
            reject(err);
          } else {
            fulfill(csrData.csr);
          }
        });
      });
    },

    createCertificate: function(options) {
      return new Promise(function(fulfill, reject) {
        pem.createCertificate(options, function(err, certData) {
          if (err) {
            reject(err);
          } else {
            fulfill(certData.certificate);
          }
        });
      });
    },

    verifySigningChain: function(certificate, ca) {
      return new Promise(function(fulfill, reject) {
        pem.verifySigningChain(certificate, ca, function(err, verify) {
          if (err) {
            reject(err);
          } else {
            fulfill(verify);
          }
        });
      });
    },
  };
})();
