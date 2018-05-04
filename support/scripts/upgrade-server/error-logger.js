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

  const Environment = require('./environment');
  const fs = require('fs');
  const Helper = require('./helper');
  const logger = require('./simple-logger');

  // global count of error messages (strings)
  let _errorCount = 0;

  class ErrorLog {
    constructor() {
      throw Error('Do not create instances of ErrorLog!');
    }

    // append error message to ERROR_LOG file
    static append(...args) {
      const text = args.join('').split('\n');
      logger.silly('append(' + text + ')');
      return new Promise((resolve, reject) => {
        const logFileName = Environment.get('ERROR_LOG');
        fs.appendFile(logFileName, Helper.logTime() + ' ' + text + '\n', (err) => {
          if (err) {
            reject(err);
          } else {
            _errorCount++;
            resolve(text);
          }
        });
      })
      .catch((err) => {
        logger.error('append | Environment:\n' + Helper.objectToString(Environment));
        throw Error('append(' + text + ')|' + Helper.objectToString(err));
      });
    }

    // use this method to append results.output to the error log file, with each
    // line of the text output indented four spaces.
    // Returns a promise
    static appendIndentedResults(results, caption=null) {
      if (results && results.output && (results.output.length > 0)) {
        return Promise.resolve()
        .then(() => {
          if (caption != null) {
            return ErrorLog.append(caption);
          }
        })
        .then(() => results.output.join('').split('\n')
        .filter((line, index, array) => (index != array.length-1) || (line.trim().length != 0))
        .reduce((promise, text) => promise.then(() => ErrorLog.append('    ' + text)), Promise.resolve()));
      } else {
        return Promise.resolve();
      }
    }

    // returns count of errors recorded
    static getCount() {
      return _errorCount;
    }
  }

  module.exports = ErrorLog;
})();
