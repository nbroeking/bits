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
  const exec = require('child_process').exec;
  const fs = require('fs');
  const logger = require('./simple-logger');
  const osenv = require('osenv');
  const spawn = require('child_process').spawn;
  const util = require('util');

  // global "whoami" value (because osenv.user does not always work)
  let helperWhoAmI = null;

  class Helper {
    constructor() {
      throw Error('Do not create instances of Helper!');
    }

    static objectToString(obj, options) {
      const defaultOptions = {
        showHidden: true,
        depth: 0,
        colors: false,
        maxArrayLength: 25,
      };
      return util.inspect(obj, Object.assign(defaultOptions, options));
    }

    static date() {
      // retrieve the current date formatted as YYYYMMDD-HHMMSS
      const d = new Date();
      return '' + d.getFullYear()
        + ('0' + (d.getMonth()+1)).slice(-2)
        + ('0' + d.getDate()).slice(-2)
        + '-'
        + ('0' + d.getHours()).slice(-2)
        + ('0' + d.getMinutes()).slice(-2)
        + ('0' + d.getSeconds()).slice(-2);
    }

    static logTime() {
      // retrieve the current time formatted as HH:MM:SS
      const d = new Date();
      return ('0' + d.getHours()).slice(-2)
        + ':'
        + ('0' + d.getMinutes()).slice(-2)
        + ':'
        + ('0' + d.getSeconds()).slice(-2)
        + '.'
        + ('00' + d.getMilliseconds()).slice(-3);
    }

    static appendToLog(text) {
      logger.silly('appendToLog(' + text + ')');
      return new Promise((resolve, reject) => {
        const logFileName = Environment.get('LOG');
        fs.appendFile(logFileName, Helper.logTime() + ' ' + text + '\n', (err) => {
          if (err) {
            reject(err);
          } else {
            resolve(text);
          }
        });
      })
      .catch((err) => {
        logger.error('appendToLog | Environment:\n' + Helper.objectToString(Environment));
        throw Error('appendToLog('+text+')|' + Helper.objectToString(err));
      });
    }

    // use this method to append results.output to the log file, with each line
    // of the text output indented four spaces.
    // Returns a promise
    static appendIndentedResultsToLog(results, caption=null) {
      if (results && results.output && (results.output.length > 0)) {
        return Promise.resolve()
        .then(() => {
          if (caption != null) {
            Helper.appendToLog(caption);
          }
        })
        .then(() => results.output.join('').split('\n')
        .filter((line, index, array) => (index != array.length-1) || (line.trim().length != 0))
        .reduce((promise, text) => promise.then(() => Helper.appendToLog('    ' + text)), Promise.resolve()));
      } else {
        return Promise.resolve();
      }
    }

    static evalAsPromise(command, args, options, _debug=false) {
      // NB: that last parameter (_debug) makes it easier to debug these
      // calls on a case-by-case basis
      args = args || [];
      options = options || {};
      if (!('env' in options)) {
        options['env'] = {};
      }
      const fullCommand = command + ' ' + args.join(' ');
      return new Promise((resolve, reject) => {
        function addDump(obj, name) {
          if (!('dump' in obj)) {
            obj['dump'] = function() {
              for (let key in this) {
                if (key === 'env') continue;
                const value = this[key];
                if (typeof(value) === 'function') continue;
                logger.verbose('DUMP: ' + name + '[' + key + '] (' + typeof(value) + '): ' + value);
              }
            };
          }
        }
        addDump(options, 'options');

        options.env = Object.assign(process.env, options.env, Environment.all);

        const results = {
          startTime: Date.now(),
          command: command,
          args: args,
          options: options,
          output: [],
        };
        addDump(results, 'results');

        logger.verbose('evalAsPromise: ' + fullCommand);
        if (_debug) {
          logger.debug('evalAsPromise: options:');
          options.dump();
        }
        const proc = spawn(command, args, options);
        if (_debug) {
          logger.debug('evalAsPromise: proc created');
        }

        proc.once('error', (err) => {
          logger.error('evalAsPromise: ERROR: command "' + fullCommand + '" FAILED: ' + err);
          reject(Object.assign(Error('evalAsPromise|' + err), results));
        });
        proc.stdout.setEncoding('utf8');
        proc.stdout.on('data', (data) => results.output.push(data));
        proc.stderr.setEncoding('utf8');
        proc.stderr.on('data', (data) => results.output.push(data));
        proc.once('close', (code, signal) => {
          logger.debug('  Exec time (' + fullCommand + '): ' + (Date.now() - results.startTime) + ' ms');
          if (_debug) {
            logger.debug(Helper.objectToString(options, {depth: 15}));
            logger.debug(Helper.objectToString(proc, {depth: 15}));
            logger.debug('evalAsPromise: SUCCESS: command "' + fullCommand + '" PASSED, code = ' + code);
            logger.debug('evalAsPromise:   output(' + fullCommand + ') is "' + results.output + '"');
          }
          results.code = code;
          results.signal = signal;
          if (code != 0) {
            // output error info for 'npm' calls
            if (command === 'npm') {
              logger.error('\n'
                + 'v'.repeat(80) + '\n'
                + 'evalAsPromise: ERROR ('
                + fullCommand
                + '): Result code is non-zero ('
                + code
                + ')');
              options.dump();
              results.dump();
              logger.error('\n' + Helper.objectToString(options.env));
              logger.error('\n' + '^'.repeat(80));
            }
          }
          if (_debug) {
            logger.debug('evalAsPromise: closing for ' + fullCommand);
          }
          resolve(results);
        });
        if (_debug) {
          logger.debug('evalAsPromise: Promise created');
        }
      })
      .catch((err) => {
        logger.error('evalAsPromise: ERROR: command "' + fullCommand + '" FAILED: ' + err);
        return Promise.reject(Error('evalAsPromise(' + fullCommand + ')|' + err));
      })
      .then((results) => {
        if (_debug) {
          logger.debug('evalAsPromise.Promise.then: results = ' + results);
        }
        return results;
      }, (err) => {
        if (_debug) {
          logger.error('evalAsPromise.Promise.catch: ' + err);
        }
        throw Error('evalAsPromise | ' + err);
      });
    }

    // Use EXEC to execute the command instead of SPAWN
    static execAsPromise(command, args, options, _debug=true) {
      // NB: that last parameter (_debug) makes it easier to debug these
      // calls on a case-by-case basis
      args = args || [];
      options = options || {};
      if (!('env' in options)) {
        options['env'] = {};
      }
      const fullCommand = command + ' ' + args.join(' ');
      return new Promise((resolve, reject) => {
        function addDump(obj, name) {
          if (!('dump' in obj)) {
            obj['dump'] = function() {
              for (let key in this) {
                if (key === 'env') continue;
                const value = this[key];
                if (typeof(value) === 'function') continue;
                logger.verbose('DUMP: ' + name + '[' + key + '] (' + typeof(value) + '): ' + value);
              }
            };
          }
        }
        addDump(options, 'options');

        options.env = Object.assign(process.env, options.env, Environment.all);

        const results = {
          startTime: Date.now(),
          command: command,
          args: args,
          options: options,
          output: [],
        };
        addDump(results, 'results');

        logger.verbose('execAsPromise: ' + fullCommand);
        if (_debug) {
          logger.debug('execAsPromise: options:');
          options.dump();
        }
        const proc = exec(fullCommand, options);
        if (_debug) {
          logger.debug('execAsPromise: proc created');
        }

        proc.once('error', (err) => {
          logger.error('execAsPromise: ERROR: command "' + fullCommand + '" FAILED: ' + err);
          reject(Object.assign(Error('execAsPromise|' + err), results));
        });
        proc.stdout.setEncoding('utf8');
        proc.stdout.on('data', (data) => results.output.push(data));
        proc.stderr.setEncoding('utf8');
        proc.stderr.on('data', (data) => results.output.push(data));
        proc.once('close', (code, signal) => {
          logger.debug('  Exec time (' + fullCommand + '): ' + (Date.now() - results.startTime) + ' ms');
          if (_debug) {
            logger.debug(Helper.objectToString(options, {depth: 15}));
            logger.debug(Helper.objectToString(proc, {depth: 15}));
            logger.debug('execAsPromise: SUCCESS: command "' + fullCommand + '" PASSED, code = ' + code);
            logger.debug('execAsPromise:   output(' + fullCommand + ') is "' + results.output + '"');
          }
          results.code = code;
          results.signal = signal;
          if (code != 0) {
            // output error info for 'npm' calls
            if (command === 'npm') {
              logger.error('\n'
                + 'v'.repeat(80) + '\n'
                + 'execAsPromise: ERROR ('
                + fullCommand
                + '): Result code is non-zero ('
                + code
                + ')');
              options.dump();
              results.dump();
              logger.error('\n' + Helper.objectToString(options.env));
              logger.error('\n' + '^'.repeat(80));
            }
          }
          if (_debug) {
            logger.debug('execAsPromise: closing for ' + fullCommand);
          }
          resolve(results);
        });
        if (_debug) {
          logger.debug('execAsPromise: Promise created');
        }
      })
      .catch((err) => {
        logger.error('execAsPromise: ERROR: command "' + fullCommand + '" FAILED: ' + err);
        return Promise.reject(Error('execAsPromise(' + fullCommand + ')|' + err));
      })
      .then((results) => {
        if (_debug) {
          logger.debug('execAsPromise.Promise.then: results = ' + results);
        }
        return results;
      }, (err) => {
        if (_debug) {
          logger.error('execAsPromise.Promise.catch: ' + err);
        }
        throw Error('execAsPromise | ' + err);
      });
    }

    static whoami() {
      if (helperWhoAmI != null) {
        return helperWhoAmI;
      } else {
        return Promise.resolve()
        .then(() => {
          helperWhoAmI = osenv.user();
          if (helperWhoAmI) {
            return helperWhoAmI;
          } else {
            return Promise.resolve()
            .then(() => Helper.evalAsPromise('whoami', []))
            .then((results) => {
              helperWhoAmI = results.output.join('\n').trim();
            });
          }
        });
      }
    }
  }

  module.exports = Helper;
})();
