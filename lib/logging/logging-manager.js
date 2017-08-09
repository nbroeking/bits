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
  const UtilChildProcess = require('./../helpers/child-process');
  const UtilFs = require('./../helpers/fs');
  const CrudManager = require('./../helpers/crud-manager');
  const LoggingApi = require('./logging-api');
  const LoggingMessenger = require('./logging-messenger');
  const LoggingRouter = require('./logging-router');
  const LoggerFactory = require('./logger-factory');
  const logger = LoggerFactory.getLogger();

  class LoggingManager extends CrudManager {
    constructor(cryptoManager) {
      super(LoggingApi.TAG, {scopes: LoggingMessenger.SCOPES, Messenger: LoggingMessenger});
      this._cryptoManager = cryptoManager;
      this._logDirs = [];
      this._holdingDir = path.resolve(global.paths.data, 'base/logging');
      this._router = new LoggingRouter(this);
    }

    load(messageCenter, baseServer) {
      return Promise.resolve()
      .then(() => this._ensureDirectoryExists(this._holdingDir))
      .then(() => super.load(messageCenter))
      .then(() => this._readdir(this._holdingDir))
      .then((filepaths) => Promise.all(filepaths.map((filepath) => {
        return this.create({filepath: filepath, filename: path.basename(filepath)});
      })))
      .then(() => {
        const logFilepath = LoggerFactory.getLogFilepath();
        if (null !== logFilepath) {
          const dirpath = path.dirname(logFilepath);
          return this.addLogDirectory({dirpath: dirpath});
        }
      })
      .then(() => this._router.load(baseServer));
    }

    unload() {
      return Promise.resolve()
      .then(() => this._router.unload())
      .then(() => super.unload());
    }

    update() {
      return Promise.reject(new Error('logging/not-able-to-update'));
    }

    delete(id) {
      return super.delete(id)
      .then((item) => {
        return UtilFs.unlink(item.filepath)
        .then(() => item);
      });
    }

    _ensureDirectoryExists(dirpath) {
      return UtilFs.mkdir(dirpath)
      .catch((err) => {
        if ('EEXIST' !== err.code) {
          return Promise.resolve(err);
        }
      });
    }

    _readdir(dirpath) {
      return Promise.resolve()
      .then(() => UtilFs.readdir(dirpath))
      .then((filenames) => filenames.map((filename) => path.resolve(dirpath, filename)));
    }

    addLogDirectory({dirpath=null}={}) {
      if (null !== dirpath) {
        this._logDirs.push(dirpath);
      }
      return Promise.resolve();
    }

    removeLogDirectory({dirpath=null}={}) {
      const index = this._logDirs.indexOf(dirpath);
      if (-1 < index) {
        this._logDirs.splice(index, 1);
      }
      return Promise.resolve();
    }

    generateCrashDump({encrypt=true}={}) {
      return Promise.resolve()
      .then(() => this._cleanTmpDirectory())
      .then(() => this._packageLogDirectories(encrypt));
    }

    _cleanTmpDirectory() {
      const dirpath = os.tmpdir();
      return Promise.resolve()
      .then(() => UtilFs.readdir(dirpath))
      .then((filenames) => filenames.filter((filename) => filename.startsWith('logs-') && '.tgz' === path.extname(filename)))
      .then((filenames) => filenames.map((filename) => path.resolve(dirpath, filename)))
      .then((filepaths) => Promise.all(filepaths.map((filepath) => UtilFs.unlink(filepath))));
    }

    _packageLogDirectories(encrypt) {
      return Promise.resolve()
      .then(() => {
        if (0 < this._logDirs.length) {
          const filename = `logs-${os.hostname()}-${(new Date()).toISOString()}.tgz`.replace(/:/g, '-');
          const packageFilepath = path.resolve(os.tmpdir(), filename);
          const cmd = 'tar';
          const args = ['cvzf', packageFilepath];
          this._logDirs.forEach((logDir) => args.push(logDir));
          return Promise.resolve()
          .then(() => UtilChildProcess.spawn(cmd, args))
          .then(() => {
            if (encrypt) {
              return Promise.resolve()
              .then(() => this._cryptoManager.encryptFileWithAvailableKeys(packageFilepath, os.tmpdir()))
              .then((result) => {
                logger.info('Encrypted base log dump.', result);
                return result.filepath;
              });
            } else {
              return packageFilepath;
            }
          })
          .then((filepath) => {
            const dst = path.resolve(this._holdingDir, path.basename(filepath));
            return Promise.resolve()
            .then(() => UtilFs.rename(filepath, dst))
            .catch((err) => {
              if ('EXDEV' === err.code) {
                return Promise.resolve()
                .then(() => UtilFs.copyFile(filepath, dst))
                .then(() => UtilFs.unlink(filepath));
              } else {
                return Promise.reject(err);
              }
            })
            .then(() => dst);
          });
        } else {
          return Promise.reject(new Error('logging/no-log-directories'));
        }
      })
      .then((filepath) => this.create({filepath: filepath, filename: path.basename(filepath)}));
    }
  }

  module.exports = LoggingManager;
})();
