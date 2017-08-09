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
  const express = require('express');
  const multer = require('multer');
  const debug = require('debug')('base:OmgPackagesRouter');
  const UtilFs = require('./../helpers/fs');
  const UtilCrypto = require('./../utils/crypto');

  let ROOT_DIR = path.join(__dirname, '../../../');
  if (global.paths && global.paths.dataRoot) {
    ROOT_DIR = global.paths.dataRoot;
  }
  const OMG_PACKAGES_DIR = path.resolve(ROOT_DIR, './data/base/omg-packages');
  const OMG_PACKAGES_UPLOADS_DIR = path.resolve(ROOT_DIR, './data/base/omg-packages/uploads');
  const OMG_PACKAGES_DECRYPTED_DIR = path.resolve(ROOT_DIR, './data/base/omg-packages/decrypted');

  const Router = express.Router;

  const convertPackageToObject = (pkg) => {
    return pkg.getInfo()
    .then((info) => {
      return {
        name: path.basename(pkg.getFilepath()),
        hash: pkg.getHash(),
        info: info,
        state: pkg.getStateString(),
      };
    });
  };

  module.exports = (packageManager, cryptoManager) => {
    const storage = multer.diskStorage({
      destination: (req, file, cb) => {
        cb(null, OMG_PACKAGES_UPLOADS_DIR);
      },
    });

    const upload = multer({storage: storage});

    const router = new Router();

    router.param('hash', (req, res, next, hash) => {
      debug('PARAM hash: %s', hash);

      const pkg = packageManager.getPackageByHash(hash);

      if (pkg) {
        req.package = pkg;
        next();
      } else {
        res.status(404).json({message: 'Cannot find OMG Package with hash ' + hash});
      }
    });

    router.route('/')
    .get((req, res, next) => {
      debug('GET /');

      packageManager.find()
      .then((packages) => {
        return Promise.all(packages.map(convertPackageToObject));
      })
      .then((packages) => {
        res.status(200).json(packages);
      }, (err) => {
        debug(err.toString());
        debug(err.stack);
        next(err);
      });
    })
    .post(upload.array('file'), (req, res, next) => {
      debug('POST /');

      const files = req.files;

      if (!Array.isArray(files) || 0 >= files.length) {
        return next(new TypeError('request must contain files'));
      }

      const errors = [];
      const warnings = [];

      files.reduce((promise, file) => {
        const filepath = file.path;

        let decryptedFilepath = null;
        let packageFilepath = null;

        return promise
        .then((packages) => {
          return cryptoManager.decryptFile(filepath, OMG_PACKAGES_DECRYPTED_DIR)
          .then((filepath) => {
            decryptedFilepath = filepath;

            const filename = path.basename(decryptedFilepath);
            const potentialFilepath = path.resolve(OMG_PACKAGES_DIR, filename);

            return UtilFs.stat(potentialFilepath)
            .then(() => {
              return UtilCrypto.randomBytes(4)
              .then((data) => {
                const suffix = '-' + data.toString('hex');
                const extname = path.extname(decryptedFilepath);
                const filename = path.basename(decryptedFilepath, extname);
                const destinationFilename = filename + suffix + extname;

                warnings.push({
                  name: file.originalname,
                  message: 'OMG Package with same name in omg-package\'s directory. Renamed ' + path.basename(decryptedFilepath) + ' to ' + destinationFilename + '.',
                });

                return path.resolve(OMG_PACKAGES_DIR, destinationFilename);
              });
            }, () => {
              const filename = path.basename(decryptedFilepath);
              return path.resolve(OMG_PACKAGES_DIR, filename);
            });
          })
          .then((destinationFilepath) => {
            packageFilepath = destinationFilepath;
            return UtilFs.rename(decryptedFilepath, packageFilepath);
          })
          .then(() => {
            decryptedFilepath = null;
            return packageManager.addPackageFromFile(packageFilepath);
          })
          .then((omgPackage) => {
            return convertPackageToObject(omgPackage);
          })
          .then((pkg) => {
            packages.push(pkg);
          }, (err) => {
            debug('Failed to add OMG Package: %s', err.toString());
            debug(err.stack);

            errors.push({
              filename: file.originalname,
              message: err.toString(),
            });

            if (packageFilepath) {
              UtilFs.unlink(packageFilepath)
              .catch(() => {
                debug('Failed to remove package file %s', packageFilepath);
              });
            }
          })
          .then(() => {
            if (decryptedFilepath) {
              UtilFs.unlink(decryptedFilepath)
              .catch(() => {
                debug('Failed to remove decrypted file %s', decryptedFilepath);
              });
            }

            UtilFs.unlink(filepath)
            .catch(() => {
              debug('Failed to remove uploaded file %s', filepath);
            });

            return packages;
          });
        });
      }, Promise.resolve([]))
      .then((packages) => {
        const response = {
          packages: packages,
          errors: errors,
          warnings: warnings,
        };

        const status = (0 < packages.length ? 200 : 400);

        res.status(status).json(response);
      }, (err) => {
        debug(err.toString());
        debug(err.stack);
        next(err);
      });
    });

    router.route('/:hash')
    .get((req, res, next) => {
      debug('GET /%s', req.params.hash);
      convertPackageToObject(req.package)
      .then((pkg) => {
        res.status(200).json(pkg);
      }, (err) => {
        debug(err.toString());
        debug(err.stack);
        next(err);
      });
    })
    .delete((req, res, next) => {
      debug('DELETE /%s', req.params.hash);

      packageManager.removePackage(req.package)
      .then((omgPackage) => {
        res.status(200).json({success: true});
      }, (err) => {
        debug(err.toString());
        debug(err.stack);
        next(err);
      });
    });

    router.route('/:hash/check')
    .get((req, res, next) => {
      debug('GET /%s/check', req.params.hash);

      packageManager.checkPackage(req.package)
      .then((conflicts) => {
        res.status(200).json(conflicts);
      }, next);
    });

    router.route('/:hash/load')
    .get((req, res, next) => {
      debug('GET /%s/load', req.params.hash);

      packageManager.loadPackage(req.package)
      .then((conflicts) => {
        res.status(200).json(conflicts);
      }, next);
    });

    return router;
  };
})();
