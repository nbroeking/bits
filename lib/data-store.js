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

  class DataStore {
    constructor(dbPath, options) {
      this._dbPath = dbPath;
      this._options = null;
      if (options) {
        this._options = options;
      }
      this._db = new Level(dbPath, this._options);
    }

    get(key) {
      return new Promise((resolve, reject) => {
        if (key) {
          this._db.get(key, (err, value) => {
            if (err) {
              if (err.notFound) {
                resolve(null);
              } else {
                reject(err);
              }
            } else {
              resolve(value);
            }
          });
        } else {
          let values = [];
          return this._db.createReadStream({keys: true, values: true}).on('data', (data) => {
            values.push(data);
          }).on('close', () => {
            resolve(values);
          }).on('error', (err) => {
            reject(err);
          });
        }
      });
    }

    findOneAndUpdate(key, value) {
      return new Promise((resolve, reject) => {
        this._db.get(key, (err, value) => {
          if (err) {
            if (err.notFound) {
              this._db.put(key, value, (err) => {
                if (err) {
                  reject(err);
                } else {
                  resolve(value);
                }
              });
            } else {
              reject(err);
            }
          } else {
            Object.keys(value).forEach((newValueKey) => {
              value[newValueKey] = value[newValueKey];
            });
            this._db.put(key, value, (err) => {
              if (err) {
                reject(err);
              } else {
                resolve(value);
              }
            });
          }
        });
      });
    }

    findOne(query) {
      return this.query(query)
      .then((values) => {
        if (values && values.length > 0) {
          return values[0];
        } else {
          return null;
        }
      });
    }

    find(q) {
      return this.get(q);
    }

    query(query) {
      return new Promise((resolve, reject) => {
        let values = [];
        return this._db.createReadStream({keys: true, values: true}).on('data', (data) => {
          values.push(data);
        }).on('close', () => {
          resolve(values);
        }).on('error', (err) => {
          reject(err);
        });
      })
      .then((values) => {
        return values.filter((value) => {
          let save = false;
          Object.keys(query).forEach((queryKey) => {
            if (value.value.hasOwnProperty(queryKey) && value.value[queryKey] === query[queryKey]) {
              save = true;
            }
          });
          return save;
        });
      });
    }

    getValues() {
      return new Promise((resolve, reject) => {
        const values = [];
        this._db.createReadStream({keys: false, values: true}).on('data', (data) => {
          values.push(data);
        }).on('close', () => {
          resolve(values);
        }).on('error', (err) => {
          reject(err);
        });
      });
    }

    put(key, value) {
      return new Promise((resolve, reject) => {
        this._db.put(key, value, (err) => {
          if (err) {
            reject(err);
          } else {
            resolve(value);
          }
        });
      });
    }

    del(key) {
      return new Promise((resolve, reject) => {
        this._db.del(key, (err) => {
          if (err) {
            reject(err);
          } else {
            resolve(key);
          }
        });
      });
    }
  }

  module.exports = DataStore;
})();
