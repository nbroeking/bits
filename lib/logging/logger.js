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

  const winston = require('winston');

  class Logger {
    constructor(options) {
      options = options || {};

      const transports = [];

      if ('string' === typeof (options.filename)) {
        transports.push(new winston.transports.File({
          filename: options.filename,
          maxFiles: 5,
          maxsize: 10 * 1024 * 1024, // 10 MB max size
          tailable: true,
          timestamp: true,
          colorize: true,
          prettyPrint: true,
          json: false,
          stringify: false
        }));
      }

      transports.push(new winston.transports.Console({
        timestamp: true,
        colorize: true,
        prettyPrint: true,
        json: false,
        stringify: false,
      }));

      this.logger = new winston.Logger({
        level: options.level,
        transports: transports,
        rewriters: [],
      });
    }

    _runOnLogger(methodName, args) {
      return this.logger[methodName](...args);
    }

    log(...args) {
      return this._runOnLogger('log', args);
    }

    error(...args) {
      return this._runOnLogger('error', args);
    }

    warn(...args) {
      return this._runOnLogger('warn', args);
    }

    info(...args) {
      return this._runOnLogger('info', args);
    }

    verbose(...args) {
      return this._runOnLogger('verbose', args);
    }

    debug(...args) {
      return this._runOnLogger('debug', args);
    }

    silly(...args) {
      return this._runOnLogger('silly', args);
    }

    set level(level) {
      this.logger.level = level;
    }

    get level() {
      return this.logger.level;
    }
  }

  module.exports = Logger;
})();
