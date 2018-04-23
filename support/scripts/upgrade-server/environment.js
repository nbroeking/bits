/**
Copyright 2018 LGS Innovations

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
  const logger = require('./simple-logger');

  // this will hold all of our environment variables
  const _environment = {};

  class Environment {
    constructor() {
      throw Error('Do not instantiate Environment!');
    }

    // dump all environment values
    static dump(title) {
      logger.info('Environment | ' + title + ': ' + Object.keys(_environment).length + ' items');
      for (let key in _environment) {
        if (_environment.hasOwnProperty(key)) {
          logger.info('  env[' + key + ']: "' + _environment[key] + '"');
        }
      }
    }

    static get all() {
      return _environment;
    }

    // Retrieve a value from the environment array
    static get(key) {
      key = key.toUpperCase();
      if (!(key in _environment)) {
        this.dump('Environment.get: missing "' + key + '"');
        throw new ReferenceError('Environment.get: missing "' + key + '"');
      }
      return _environment[key];
    }

    // Set the value in our environment array (replace value if it already exists)
    static set(key, value) {
      key = key.toUpperCase();
      _environment[key] = value;
    }

    // Set the value in our environment, but only if the key does not yet exist
    static setIfNotExist(key, value) {
      key = key.toUpperCase();
      if (!(key in _environment)) {
        this.set(key, value);
      }
    }

    // load environment key-value pairs from this file (if it exists)
    // returns a promise
    static load(envPath) {
      // does the file exist?
      return new Promise((resolve, reject) => {
        fs.stat(envPath, (err, stats) => {
          if (err || !stats.isFile()) {
            reject(err);
          } else {
            resolve(envPath);
          }
        });
      })
      .then((validFilePath) => {
        return new Promise((resolve, reject) => {
          // the file exists... process it
          fs.readFile(validFilePath, 'utf8', (err, contents) => {
            if (err) {
              reject(err);
            } else {
              resolve(contents);
            }
          });
        })
        .then((contents) => {
          // the file contains something... process those contents
          contents.trim().split('\n').forEach((line) => {
            // remove comments
            const commentIndex = line.indexOf('#');
            if (commentIndex != -1) {
              line = line.substring(0, commentIndex);
            }
            line = line.trimLeft();
            // split into <key>=<value>
            let fieldIndex = line.indexOf('=');
            if (fieldIndex === -1) {
              // if there's no equal sign, treat it as a variable that is set but
              // which has no value
              fieldIndex = line.length;
            }
            const key = line.substring(0, fieldIndex);
            const value = line.substring(fieldIndex+1);
            // if this item has a key, set the key/value pair
            if (key.length > 0) {
              Environment.set(key, value);
            }
          });
        });
      }, () => {
        // no .env file... just keep going
      });
    }
  } // Environment

  module.exports = Environment;
})();
