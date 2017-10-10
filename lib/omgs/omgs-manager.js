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

  const HEADER_LENGTH_REGEX = new RegExp('^(\\d+)#');

  const semver = require('semver');
  const fs = require('fs');
  const path = require('path');
  const EventEmitter = require('events');
  const UtilFs = require('./../helpers/fs');
  const UtilCrypto = require('./../utils/crypto');
  const OmgsMessenger = require('./omgs-messenger');
  const OmgsRouter = require('./omgs-router');
  const LoggerFactory = require('./../logging/logger-factory');
  const logger = LoggerFactory.getLogger();

  function noop() {}

  class OmgsManager extends EventEmitter {
    constructor(cryptoManager, moduleManager) {
      super();
      this._cryptoManager = cryptoManager;
      this._moduleManager = moduleManager;
      this.infos = [];

      let baseDataDir = '/tmp';
      if (global.paths && global.paths.data) {
        baseDataDir = path.resolve(global.paths.data, './base');
      }

      this._omgsDir = path.resolve(baseDataDir, './omgs');
      this._rawsDir = path.resolve(this._omgsDir, './raws');
      this._infosDir = path.resolve(this._omgsDir, './infos');
      this._uploadsDir = path.resolve(this._omgsDir, './uploads');
      this._currentOmgFilepath = path.resolve(this._omgsDir, './currentOmg.json');
      this._currentOmgInfo = null;

      this._router = new OmgsRouter(this);
      this._messenger = new OmgsMessenger(this);
    }

    load(baseServer, messageCenter) {
      return Promise.resolve()
      .then(() => this._ensureDirectoriesExist())
      .then(() => this._loadCurrentOmg())
      .then(() => this._loadInfos())
      .then(() => this._router.load(baseServer, messageCenter))
      .then(() => this._messenger.load(messageCenter));
    }

    unload(base) {
      return Promise.resolve()
      .then(() => {
        this._omgsDir = null;
        this._rawsDir = null;
        this._infosDir = null;
        this._uploadsDir = null;
      });
    }

    list() {
      return Promise.resolve(this.infos);
    }

    get(id) {
      const omg = this.infos.find((omg) => id === omg.id);
      if (omg) {
        return omg;
      } else {
        return null;
      }
    }

    loadOmg(id) {
      const omg = this.get(id);
      if (omg) {
        const baseInfo = omg.data.modules.find((mod) => 'bits-base' === mod.name);
        if (baseInfo && semver.major(baseInfo.version) <= 1) {
          // do not allow downgrades to 1.x.y or lower
          return Promise.reject(new Error('omg/incompatable-version'));
        }

        const romgFilepath = omg.internal.romgFilepath;
        const infoFilepath = omg.internal.infoFilepath;

        logger.info('Loading OMG %s...', id, {
          romgFilepath: romgFilepath
        });

        return UtilFs.copyFile(infoFilepath, this._currentOmgFilepath)
        .then(() => this._moduleManager.upgradeBase(romgFilepath));
      } else {
        return Promise.reject(new Error('omg/load-omg-does-not-exist'));
      }
    }

    getCurrentOmgInfo() {
      return Promise.resolve(this._currentOmgInfo);
    }

    getUploadDirectory() {
      return this._uploadsDir;
    }

    _ensureDirectoryExist(dirpath) {
      return UtilFs.mkdir(dirpath)
      .catch((err) => {
        if ('EEXIST' !== err.code) {
          throw err;
        }
      });
    }

    _ensureDirectoriesExist() {
      return this._ensureDirectoryExist(this._omgsDir)
      .then(() => this._ensureDirectoryExist(this._rawsDir))
      .then(() => this._ensureDirectoryExist(this._infosDir))
      .then(() => this._ensureDirectoryExist(this._uploadsDir));
    }

    _loadInfo(filepath) {
      return UtilFs.readJSON(filepath)
      .then((info) => this.infos.push(info));
    }

    _loadInfos() {
      return UtilFs.readdir(this._infosDir)
      .then((filenames) => {
        const filepaths = filenames.map((filename) => path.resolve(this._infosDir, filename));
        return filepaths.reduce((chain, filepath) => chain.then(() => this._loadInfo(filepath)), Promise.resolve());
      });
    }

    _loadCurrentOmg() {
      return UtilFs.readJSON(this._currentOmgFilepath)
      .catch((err) => {
        if ('ENOENT' === err.code) {
          logger.warn(`Failed to read current OMG info: ${err.message}.`, {
            error: {
              name: err.name,
              message: err.message,
              stack: err.stack
            }
          });
        }
        return null;
      })
      .then((info) => {
        this._currentOmgInfo = info;
      });
    }

    _addOmg(omg) {
      if (!this._isUploadingState(omg.state)) {
        return Promise.reject(new Error(`OMG ${omg.id} with state ${omg.state} cannot be added.`));
      }

      omg.state = 'Reading header';
      omg.updatedAt = process.hrtime();
      this.emit('updated', [omg]);

      return this._getHeader(omg.internal.omgFilepath)
      .then((header) => {
        const headerData = header.data;
        omg.data.name = headerData.name;
        omg.data.branch = headerData.branch;
        omg.data.version = headerData.version;
        omg.data.arch = headerData.arch;
        omg.data.modules = headerData.modules;
        omg.data.encryptionKeyHash = headerData.encryptionKeyHash;
        omg.data.signatureKeyHash = headerData.signatureKeyHash;

        // Check if this OMG exists already.
        if (this._isDuplicateOMG(omg)) {
          return Promise.reject(new Error('OMG is a duplicate.'));
        }

        const filename = `${omg.data.name}_${omg.data.branch}_${omg.data.version}_${omg.data.arch}`;
        omg.internal.romgFilepath = path.resolve(this._rawsDir, `${filename}.romg`);
        omg.internal.infoFilepath = path.resolve(this._infosDir, `${filename}.json`);
        omg.internal.end = header.end;

        omg.state = 'Decrypting';
        omg.updatedAt = process.hrtime();
        this.emit('updated', [omg]);

        return this._decryptOmg(omg);
      })
      .then((decryptFilepath) => {
        // Re-check if this OMG exists already.
        if (this._isDuplicateOMG(omg)) {
          return UtilFs.unlink(decryptFilepath)
          .then(() => Promise.reject(new Error('OMG is a duplicate.')));
        }
        // TODO: Set the 'Ready' state here so a possible race condition is
        // avoided with duplicate checks.
        return UtilFs.rename(decryptFilepath, omg.internal.romgFilepath);
      })
      .then(() => {
        omg.state = 'Ready';
        omg.updatedAt = process.hrtime();
        this.emit('updated', [omg]);

        logger.info('Added OMG %s', omg.id, {
          id: omg.id,
          data: omg.data
        });

        omg.internal.output = null;

        return this._writeOmgInfoFile(omg);
      });
    }

    _isDuplicateOMG(testOmg) {
      const duplicateOmg = this.infos.find((omg) => {
        return testOmg.id !== omg.id &&
            testOmg.data.name === omg.data.name &&
            testOmg.data.branch === omg.data.branch &&
            testOmg.data.version === omg.data.version &&
            testOmg.data.arch === omg.data.arch &&
            'Ready' === omg.state;
      });
      if (duplicateOmg) {
        return true;
      } else {
        return false;
      }
    }

    _getHeader(filepath) {
      return new Promise((resolve, reject) => {
        const input = fs.createReadStream(filepath);

        const header = {
          length: -1,
          start: -1,
          end: -1,
          data: null
        };

        let onEnd = null;

        let dataString = '';
        let onData = (chunk) => {
          dataString += chunk.toString('utf8');

          if (header.length < 0) {
            const match = dataString.match(HEADER_LENGTH_REGEX);
            if (match) {
              const lengthString = match[1];
              header.length = Number(lengthString);
              header.start = lengthString.length + 1;
              header.end = header.start + header.length;
            }
          }

          if (-1 < header.length && header.end < dataString.length) {
            const headerDataString = dataString.slice(header.start, header.end);
            try {
              header.data = JSON.parse(headerDataString);
              onEnd();
            } catch (err) {
              reject(err);
            }
          }
        };

        onEnd = () => {
          input.removeListener('data', onData);
          input.removeListener('end', onEnd);
          resolve(header);
        };

        input.on('readable', () => {
          input.on('data', onData);
          input.on('end', onEnd);
        });

        input.on('error', reject);
      });
    }

    _decryptOmg(omg) {
      const omgFilepath = omg.internal.omgFilepath;
      const offset = omg.internal.end;
      const signatureKeyHash = omg.data.signatureKeyHash;
      const encryptionKeyHash = omg.data.encryptionKeyHash;
      return this._cryptoManager.decryptFileWithKeyAndOffset(omgFilepath, this._rawsDir, encryptionKeyHash, signatureKeyHash, offset);
    }

    _writeOmgInfoFile(omg) {
      return this._writeInfoFile(omg.internal.infoFilepath, omg);
    }

    _writeInfoFile(filepath, omg) {
      return UtilFs.writeFile(filepath, JSON.stringify(omg, null, 2), 'utf8');
    }

    _createId() {
      return UtilCrypto.randomBytes(6)
      .then((buf) => buf.toString('hex'));
    }

    add({name=(new Date()).toUTCString(), filepath=null}={}) {
      return Promise.resolve()
      .then(() => this._createId())
      .then((id) => {
        const now = process.hrtime();
        const omg = {
          id: id,
          state: 'Uploading',
          data: {
            name: name,
            branch: null,
            version: null,
            arch: null
          },
          internal: {
            omgFilepath: filepath,
            romgFilepath: null,
            infoFilepath: null
          },
          createdAt: now,
          updatedAt: now
        };
        this.infos.push(omg);
        this.emit('created', [omg]);

        this._addOmg(omg)
        .catch((err) => {
          const filepath = omg.internal.omgFilepath;
          logger.error('Failed to add %s: %s', filepath, err.message, {
            error: {
              name: err.name,
              message: err.message,
              stack: err.stack
            },
            id: omg.id,
            filepath: filepath
          });

          omg.state = 'Failed';
          omg.data.branch = err.message;
          this.emit('updated', [omg]);
        })
        .then(() => UtilFs.unlink(omg.internal.omgFilepath));

        return omg;
      })
      .catch((err) => {
        logger.error('Unable to add OMG from filepath', err);
        throw err;
      });
    }

    _isUploadingState(state) {
      return 'Uploading' === state || 'Stalled' === state;
    }

    delete(id) {
      const omg = this.get(id);
      if (omg) {
        return UtilFs.unlink(omg.internal.omgFilepath)
        .catch(noop)
        .then(() => UtilFs.unlink(omg.internal.romgFilepath))
        .catch(noop)
        .then(() => UtilFs.unlink(omg.internal.infoFilepath))
        .catch(noop)
        .then((value) => {
          const index = this.infos.indexOf(omg);
          this.infos.splice(index, 1);

          this.emit('deleted', [omg]);

          logger.info('Removed OMG %s', omg.id, {id: omg.id});

          return omg;
        });
      } else {
        return Promise.resolve(null);
      }
    }
  }

  module.exports = OmgsManager;
})();
