(() => {
  'use strict';

  const EventEmitter = require('events');
  const level = require('level');

  class PersistentKeyValueManager extends EventEmitter {
    constructor({location}) {
      super();
      this._db = level(location, {valueEncoding: 'json'});
    }

    set({key, value}) {
      return new Promise((resolve, reject) => {
        this._db.put(key, value, (err) => {
          if (err) {
            reject(err);
          } else {
            this.emit('set', {key: key, value: value});
            resolve();
          }
        });
      });
    }

    get({key}) {
      return new Promise((resolve, reject) => {
        this._db.get(key, (err, value) => {
          if (err) {
            if (err.notFound) {
              reject(new Error('key not found'));
            } else {
              reject(err);
            }
          } else {
            resolve(value);
          }
        });
      });
    }

    has({key}) {
      return new Promise((resolve, reject) => {
        this._db.get(key, (err, value) => {
          if (err) {
            if (err.notFound) {
              resolve(false);
            } else {
              reject(err);
            }
          } else {
            resolve(true);
          }
        });
      });
    }

    delete({key}) {
      return new Promise((resolve, reject) => {
        this._db.del(key, (err) => {
          if (err) {
            reject(err);
          } else {
            this.emit('delete', {key: key});
            resolve();
          }
        });
      });
    }

    clear() {
      return Promise.resolve()
      .then(() => this.keys())
      .then((keys) => Promise.all(keys.map((key) => this.delete({key: key}))))
      .then(() => this.emit('clear'));
    }

    keys() {
      return new Promise((resolve, reject) => {
        const keys = [];
        const keyStream = this._db.createKeyStream();
        keyStream.on('error', reject);
        keyStream.on('data', (key) => keys.push(key));
        keyStream.on('end', resolve(keys));
      });
    }

    values() {
      return new Promise((resolve, reject) => {
        const values = [];
        const valueStream = this._db.createValueStream();
        valueStream.on('error', reject);
        valueStream.on('data', (value) => values.push(value));
        valueStream.on('end', resolve(values));
      });
    }
  }

  module.exports = PersistentKeyValueManager;
})();
