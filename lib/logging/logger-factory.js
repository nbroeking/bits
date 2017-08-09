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

  const path = require('path');
  const parseArgs = require('minimist');
  const winston = require('winston');
  const Logger = require('./logger');

  let dataPath = '/tmp';
  if (global.paths && global.paths.data) {
    dataPath = global.paths.data;
  }
  winston.handleExceptions([
    new winston.transports.Console({json: true}),
    new winston.transports.File({filename: path.join(dataPath, '/base/node-exceptions.log')}),
  ]);

  const args = parseArgs(process.argv, {
    default: {verbose: false, output: null, silly: false},
    alias: {verbose: ['v'], output: ['o']},
  });

  let sLogLevel = 'info';
  if (args.silly) {
    sLogLevel = 'silly';
    args.verbose = true;
  } else if (args.verbose) {
    sLogLevel = 'debug';
  }

  let sFilepath = null;
  if ('string' === typeof (args.output)) {
    let output = args.output;

    if (!path.isAbsolute(output)) {
      output = path.resolve(process.cwd(), output);
    }

    sFilepath = path.join(output, './node.log');
  }

  let sLogger = null;

  class LoggerFactory {
    constructor() {
      throw new Error('do not create instance');
    }

    static getLogFilepath() {
      return sFilepath;
    }

    static getLogger() {
      if (null === sLogger) {
        sLogger = new Logger({level: sLogLevel, filename: sFilepath});
      }
      return sLogger;
    }

    static setLevel(level) {
      const logger = LoggerFactory.getLogger();
      logger.level = level;
    }
  }


  global.LoggerFactory = LoggerFactory;

  module.exports = LoggerFactory;
})();
