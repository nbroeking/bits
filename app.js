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

  const parseArgs = require('minimist');
  const path = require('path');

  // Parsing args
  const args = parseArgs(process.argv, {
    default: {rootDataDir: path.join(__dirname, '/data')},
    alias: {rootDataDir: ['d']},
  });

  // Set initial Globals
  if (!global.hasOwnProperty('paths')) {
    global.paths = {};
  }
  global.paths.data = args.rootDataDir;

  const os = require('os');
  const cluster = require('cluster');
  const Base = require('./lib/bits-base');
  const LoggerFactory = require('./lib/logging/logger-factory');

  // Create instance managers
  const logger = LoggerFactory.getLogger();

  global.numberOfCpu = os.cpus();

  const base = new Base();

  // Master specific
  if (cluster.isMaster) {
    // Set up the normal bits stack
    process.on('uncaughtException', (err) => {
      if (err instanceof Error) {
        logger.error(`Uncaught exception occurred in BITS Master cluster: ${err.message}\n ${err.stack}`);
      } else {
        logger.error('Uncaught exception occurred without error:', err);
      }
    });

    process.on('unhandledRejection', (err) => {
      if (err instanceof Error) {
        logger.error('Unhandled Rejection: %s', err.message, err);
      } else {
        logger.error('Unhandled Rejection occurred without error:', err);
      }
    });

    return Promise.resolve()
    .then(() => base.initialize())
    .then(() => logger.info('Application started'))
    .then(() => base.load())
    .then(() => logger.info('Base has completed loading'))
    .catch((err) => {
      logger.error('Error starting application: %s', err.toString(), {error: err});
      logger.error(err.stack);
      process.exit(1);
    });
  } else if (cluster.isWorker) {
    const encodedModuleInfo = process.env.mod;
    const moduleInfo = JSON.parse(encodedModuleInfo);
    const moduleName = moduleInfo.name;

    process.on('uncaughtException', (err) => {
      if (err instanceof Error) {
        logger.error(`Uncaught exception in module '${moduleName}': ${err.message}\n ${err.stack}`);
      } else {
        logger.error(`Uncaught exception in module '${moduleName}' without error:`, err);
      }
    });

    process.on('unhandledRejection', (err) => {
      if (err instanceof Error) {
        logger.error(`Unhandled rejection in module '${moduleName}': ${err.message}\n ${err.stack}`);
      } else {
        logger.error(`Unhandled Rejection in module '${ moduleName }' without error:`, err);
      }
    });

    base.dispatchModule(moduleInfo);
  }
})();
