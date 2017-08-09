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
  const Certificate = require('../utils/certificate');
  const LoggerFactory = require('../logging/logger-factory');
  const CertificatesMessenger = require('./certificate-messenger');
  const logger = LoggerFactory.getLogger();

  let DEFAULT_BASE = '/tmp';
  let DEFAULT_CERTS_DIR = path.resolve(DEFAULT_BASE, 'base');
  if (global.paths && global.paths.data) {
    DEFAULT_BASE = path.resolve(global.paths.data, 'base');
    DEFAULT_CERTS_DIR = path.resolve(DEFAULT_BASE, 'certs');
  }

  class CertManager {
    constructor(certsDir) {
      this._certs = [];
      this._certsDir = (certsDir ? certsDir : DEFAULT_CERTS_DIR);
      this._messenger = new CertificatesMessenger(this);
    }

    load(messageCenter) {
      return UtilFs.mkdir(DEFAULT_BASE).catch((err) => {}) // Mkdir if not exists
      .then(() => UtilFs.mkdir(this._certsDir)).catch((err) => {}) // Mkdir if not exists
      .then(() => this._addCertsFromCertsDirectory(this._certsDir))
      .then(() => this._messenger.load(messageCenter));
    }

    _addCertsFromCertsDirectory(certsDir) { // recursively searches directory for .crt files
      return UtilFs.readdir(certsDir)
      .then((filenames) => {
        return filenames.filter((item) => !(/(^|\/)\.[^\/\.]/g).test(item)); // no hidden files/dirs
      })
      .then((filenames) => {
        return filenames.reduce((promise, filename) => {
          return promise.then(() => {
            const filepath = path.resolve(certsDir, filename);
            return UtilFs.stat(filepath)
            .then((ret) => {
              if (ret.isDirectory()) {
                return this._addCertsFromCertsDirectory(filepath);
              } else {
                let ext = filename.substr(filename.lastIndexOf('.'));
                if (ext === '.crt') {
                  return this.addCertFromFilepath(filepath);
                }
              }
            });
          })
          .then(null, (err) => {
            logger.error('Failed to add cert %s: %s', filename, err.toString());
          });
        }, Promise.resolve());
      });
    }

    getCertByHash(hash) {
      const cert = this._certs.find((cert) => cert.getHash() === hash);
      if (cert) {
        return cert;
      } else {
        return null;
      }
    }

    getCertByPath(path) {
      const matches = this._certs.filter((cert) => cert.getFilepath() === path);
      if (0 < matches.length) {
        return matches[0];
      } else {
        return null;
      }
    }

    addCertFromFilepath(filepath, {copy=false}={}) {
      return Certificate.fromFile(filepath)
      .then((cert) => {
        const dupCert = this.getCertByHash(cert.getHash());
        if (dupCert) {
          return Promise.reject(new Error('certs/duplicate-cert'));
        }
        this._certs.push(cert);
        if (copy) {
          const dst = path.resolve(this._certsDir, path.basename(filepath));
          return UtilFs.copyFile(filepath, dst)
          .then(() => cert.setFilepath(dst))
          .then(() => cert);
        }
        return cert;
      });
    }

    removeCertByHash(hash) {
      const cert = this.getCertByHash(hash);
      if (!cert) {
        return Promise.reject(new Error('certs/cert-not-found'));
      }
      const index = this._certs.indexOf(cert);
      this._certs.splice(index, 1);
      return Promise.resolve(cert);
    }

    getCertList() {
      return Promise.resolve(this._certs);
    }

    getDeviceServerCert() {
      return this.getCertList()
      .then((certs) => {
        const matches = certs.filter((cert) => {
          const keyName = path.basename(cert.path, '.crt');
          return 'device-server' === keyName;
        });

        if (0 < matches.length) {
          return matches[0];
        } else {
          return null;
        }
      });
    }

    getDeviceClientCert() {
      return this.getCertList()
      .then((certs) => {
        const matches = certs.filter((cert) => {
          const keyName = path.basename(cert.path, '.crt');
          return 'device-client' === keyName;
        });

        if (0 < matches.length) {
          return matches[0];
        } else {
          return null;
        }
      });
    }

    reloadCerts() {
      this.clearCerts();
      this._addCertsFromCertsDirectory(this._certsDir);
    }

    clearCerts() {
      this._keys = [];
    }

    create({filepath=null}={}) {
      return this.addCertFromFilepath(filepath, {copy: true});
    }

    list() {
      return this.getCertList();
    }

    delete({hash=null}={}) {
      return this.removeCertByHash(hash)
      .then((cert) => UtilFs.unlink(cert.getFilepath()));
    }

    static get Cert() {
      return Certificate;
    }

    get Cert() {
      return CertManager.Cert;
    }
  }

  module.exports = CertManager;
})();
