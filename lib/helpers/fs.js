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

  const fs = require('fs');
  const path = require('path');
  const which = require('which');

  class UtilFs {
    constructor() {
      throw new Error('do not create an instance');
    }

    static delayBy(timeout) {
      return new Promise((resolve) => setTimeout(resolve, timeout));
    }

    static delay(timeout) {
      return UtilFs.delayBy(timeout);
    }

    static exists(filepath) {
      return new Promise((resolve, reject) => {
        fs.access(filepath, fs.constants.F_OK, (err) => {
          if (err) {
            resolve(false);
          } else {
            resolve(true);
          }
        });
      });
    }

    static stat(path) {
      return new Promise((resolve, reject) => {
        fs.stat(path, (err, stats) => {
          if (err) {
            reject(err);
          } else {
            resolve(stats);
          }
        });
      });
    }

    static lstat(path) {
      return new Promise((resolve, reject) => {
        fs.lstat(path, (err, stats) => {
          if (err) {
            reject(err);
          } else {
            resolve(stats);
          }
        });
      });
    }

    static readdir(path) {
      return new Promise((resolve, reject) => {
        fs.readdir(path, (err, files) => {
          if (err) {
            reject(err);
          } else {
            resolve(files);
          }
        });
      });
    }

    static mkdir(path, mode) {
      return new Promise((resolve, reject) => {
        fs.mkdir(path, mode, (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
    }

    static mkdirp(dirpath) {
      return UtilFs.ensureDirectoryExists(dirpath)
      .catch((err) => {
        if ('ENOENT' === err.code) {
          return UtilFs.mkdirp(path.dirname(dirpath))
          .then(() => UtilFs.mkdir(dirpath));
        }
        return Promise.reject(err);
      });
    }

    static ensureDirectoryExists(dirpath) {
      return UtilFs.mkdir(dirpath)
      .catch((err) => {
        if (err.code !== 'EEXIST') {
          return Promise.reject(err);
        }
      });
    }

    static _rmdir(path) {
      return new Promise((resolve, reject) => {
        fs.rmdir(path, (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
    }

    static rmdir(dirpath, {recursive=false}) {
      if (recursive) {
        return UtilFs.readdir(dirpath)
        .then((filenames) => {
          return Promise.all(filenames.map((filename) => {
            const filepath = path.resolve(dirpath, filename);
            return UtilFs.lstat(filepath)
            .then((stats) => {
              if (stats.isDirectory()) {
                return UtilFs.rmdir(filepath, {recursive: recursive});
              } else {
                return UtilFs.unlink(filepath);
              }
            });
          }));
        })
        .then(() => {
          return UtilFs._rmdir(dirpath);
        });
      } else {
        return UtilFs._rmdir(dirpath);
      }
    }

    static appendFile(file, data, options) {
      return new Promise((resolve, reject) => {
        fs.appendFile(file, data, options, (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
    }

    static writeFile(file, data, options) {
      return new Promise((resolve, reject) => {
        fs.writeFile(file, data, options, (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
    }

    static readFile(file, options) {
      return new Promise((resolve, reject) => {
        fs.readFile(file, options, (err, data) => {
          if (err) {
            reject(err);
          } else {
            resolve(data);
          }
        });
      });
    }

    static rename(oldPath, newPath) {
      return new Promise(function(resolve, reject) {
        fs.rename(oldPath, newPath, (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
    }

    static unlink(path) {
      return new Promise((resolve, reject) => {
        fs.unlink(path, (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
    }

    static copyFile(fromPath, toPath) {
      return new Promise(function(fulfill, reject) {
        // Create the read stream
        let rd = fs.createReadStream(fromPath);
        // Add 'error' event for read stream
        rd.on('error', reject);

        // Create the write stream
        let wr = fs.createWriteStream(toPath);
        // Add 'error' and 'close' events for write stream
        wr.on('error', reject);
        wr.on('close', fulfill);

        // Write the read stream to the write stream
        rd.pipe(wr);
      })
      .catch((err) => {
        UtilFs.unlink(toPath).catch((e) => null);
        return Promise.reject(err);
      });
    }

    static createReadStream(path, options) {
      return fs.createReadStream(path, options);
    }

    static createWriteStream(path, options) {
      return fs.createWriteStream(path, options);
    }

    static readJSON(filename) {
      return UtilFs.readFile(filename, 'utf8').then(JSON.parse);
    }

    static readJsonFiles(arrayOfFilenames) {
      return Promise.all(arrayOfFilenames.map(UtilFs.readJSON));
    }

    static which(command, options) {
      options = options || {};

      return new Promise((resolve, reject) => {
        which(command, options, (error, path) => {
          if (error) {
            reject(new Error(`unable to locate a candidate for ${command}`));
          }
          resolve(path);
        });
      });
    }
  }

  module.exports = UtilFs;
})();
