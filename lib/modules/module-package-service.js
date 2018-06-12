(() => {
  'use strict';

  const path = require('path');
  const os = require('os');
  const UtilFs = require('./../helpers/fs');
  const UtilChildProcess = require('./../helpers/child-process');
  const logger = global.LoggerFactory.getLogger();

  class ModulePackageService {
    constructor(moduleManager, cryptoManager, keyManager) {
      this._manager = cryptoManager;
      this._moduleManager = moduleManager;
      this._keyManager = keyManager;
      this._cryptoManager = cryptoManager;
      this._modulesDir = moduleManager.getModuleDir();
      this._modulesPackagesStagingDir = os.tmpdir();
    }

    load() {
      return Promise.resolve();
    }

    unload() {
      return Promise.resolve();
    }

    installModule(file) {
      const modPath = path.resolve(this._modulesPackagesStagingDir, file.filename + '-mod');
      return Promise.resolve()
      .then(() => UtilFs.mkdir(modPath))
      .then(() => Promise.all([this._keyManager.getBitsSignaturePublicKey(), this._keyManager.getPrivateKeyList()]))
      .then(([signingKey, privateKeyList]) => {
        if (!signingKey) {
          return Promise.reject(new Error('No signing key on system'));
        }
        if (!privateKeyList || privateKeyList.length === 0) {
          return Promise.reject(new Error('No encryption key candidates found'));
        }
        return Promise.all(privateKeyList.map((key) => {
          return this._cryptoManager.decryptFileWithKey(file.path, this._modulesPackagesStagingDir, key._hash, signingKey._hash)
          .catch((err) => {
            return null;
          });
        }))
        .then((results) => results.find((result) => !!result));
      })
      .then((filename) => {
        if (!filename) {
          return Promise.reject(new Error('No keys could decrypt module'));
        } else {
          logger.debug('Successfully unsigned and decrypted module');
        }
        const command = 'tar';
        const args = [
          '--warning=none',
          '-x',
          '-f', filename,
          '-C', modPath
        ];

        return UtilChildProcess.spawn(command, args)
        .then((result) => {
          return {
            filename: filename,
            result: result
          };
        });
      })
      .then(({filename, result}) => {
        logger.debug('Finished Untarring Module');
        if (result.code !== 0) {
          return Promise.reject(new Error('Error processing package'));
        } else {
          return UtilFs.unlink(filename)
          .then(() => filename);
        }
      })
      .then((result) => {
        return Promise.resolve()
        .then(() => this._moduleManager.readModuleInfo(modPath))
        .then((info) => {
          if (!info) {
            return Promise.reject(new Error('Invalid module.json'));
          } else if (info.name === 'bits-base') {
            return Promise.reject(new Error('Can not upgrade base from single module upload: please use an omg'));
          } else {
            return this._moduleManager.installModule(info, modPath);
          }
        });
      })
      .then((result) => {
        return UtilFs.unlink(file.path)
        .then(() => result);
      });
    }
  };
  module.exports = ModulePackageService;
})();
