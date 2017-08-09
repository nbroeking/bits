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

  const Level = require('level');

  class LevelDB {
    constructor(location, options) {
      this._db = new Level(location, options);
    }

    open() {
      return new Promise((resolve, reject) => {
        this._db.open((err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
    }

    close() {
      return new Promise((resolve, reject) => {
        this._db.close((err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
    }

    put(key, value, options) {
      return new Promise((resolve, reject) => {
        this._db.put(key, value, options, (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
    }

    get(key, options) {
      return new Promise((resolve, reject) => {
        this._db.get(key, options, (err, value) => {
          if (err) {
            reject(err);
          } else {
            resolve(value);
          }
        });
      });
    }

    del(key, options) {
      return new Promise((resolve, reject) => {
        this._db.del(key, options, (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
    }

    batch(array, options) {
      return new Promise((resolve, reject) => {
        this._db.batch(array, options, (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
    }

    writeBatch(batch) {
      return new Promise((resolve, reject) => {
        batch.write((err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
    }

    isOpen() {
      return this._db.isOpen();
    }

    isClosed() {
      return this._db.isClosed();
    }

    createReadStream(options) {
      return this._db.createReadStream(options);
    }

    createKeyStream(options) {
      return this._db.createKeyStream(options);
    }

    createValueStream(options) {
      return this._db.createValueStream(options);
    }

    dump() {
      return new Promise((resolve, reject) => {
        this._db.createReadStream()
        .on('error', reject)
        .on('data', (data) => {
          console.log(`--- ${data.key} ---`);
          console.log(require('util').inspect(data.value, {colors: true, depth: null}));
        })
        .on('end', resolve);
      });
    }
  }

  module.exports = LevelDB;
})();
