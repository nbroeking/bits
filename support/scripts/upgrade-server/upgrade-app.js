#!/usr/bin/env node
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
  const Helper = require('./helper');
  const logger = require('./simple-logger');
  const parseArgs = require('minimist');
  const path = require('path');
  const UpgradeServer = require('./upgrade-server');
  const UpgradeScript = require('./upgrade-script');
  const BaseLoadUrl = require('./base-load-url');
  const MiniMessageCenter = require('./mini-message-center');

  const args = parseArgs(process.argv, {
    default: {
      rootBaseDir: '/opt/bits/',
      rootDataDir: '/var/bits',
      target: '',
      help: false,
      logLevel: 'info', // error=0, warn=1, info=2, verbose=3, debug=4, silly=5
      outputFile: '/tmp/upgrade-output-file.log',
    },
    alias: {
      rootBaseDir: ['P', '-base'],
      rootDataDir: ['d', '-data'],
      target: ['t', '-target'],
      help: ['h', '-help'],
      logLevel: ['l', '-level'],
      outputFile: ['o', '-output'],
    },
  });

  if (args.help) {
    printUsage();
  }
  if (!args.rootBaseDir) {
    logger.error('ERROR: no base dir specified');
    printUsage();
  } else {
    logger.info('Base dir: ' + args.rootBaseDir);
  }
  if (!args.rootDataDir) {
    logger.error('ERROR: no data dir specified');
    printUsage();
  } else {
    logger.info('Data dir: ' + args.rootDataDir);
  }
  if (!args.target) {
    logger.error('ERROR: need to supply new base ROMG');
    printUsage();
  } else {
    logger.info('Target: ' + args.target);
  }
  const validLevels = ['error', 'warn', 'info', 'verbose', 'debug', 'silly'];
  if (validLevels.includes(args.logLevel)) {
    logger.level = args.logLevel;
  } else {
    logger.error('ERROR: invalid log level provided (' + args.logLevel + ')');
    printUsage();
  }

  // Set initial Globals
  const global = {};
  global.paths = {};
  global.paths.data = args.rootDataDir;
  global.paths.base = args.rootBaseDir;

  // Initialize our "environment"
  Environment.set('BASE_DIR', args.rootBaseDir);
  Environment.set('DATA_DIR', args.rootDataDir);
  Environment.set('TARGET', args.target);
  Environment.set('LOG', args.outputFile);
  Environment.set('DATE', Helper.date());
  Environment.set('YARN_INSTALL_ERROR', 0);
  Environment.setIfNotExist('BACKUP_DIR', path.join(Environment.get('BASE_DIR'), 'upgrade-' + Helper.date()));
  Environment.setIfNotExist('TARGET_EXTRACT', path.join(Environment.get('BACKUP_DIR'), 'extract'));

  // create our message messageCenter
  this._messageCenter = new MiniMessageCenter(process);

  // here is the core process
  this._baseLoadUrl = new BaseLoadUrl();
  this._baseLoadUrl.load('UPGRADE', this._messageCenter);

  this._upgradeScript = new UpgradeScript();
  Promise.resolve()
  .then(() => Helper.appendToLog('* Initializing BITS Upgrade (v2)'))
  .then(() => logger.debug('*** Starting the core upgrade process'))
  .then(() => Helper.whoami())
  .then(() => UpgradeScript.configureEnvironment())
  .then(() => UpgradeScript.stopBitsServer())
  .then(() => logger.debug('BITS Server Stopped'))
  .then(() => {
    // Create server instance
    Helper.appendToLog('* Launching UpgradeServer(' + args.rootBaseDir + ', ' + args.rootDataDir + ')');
    this._upgradeServer = new UpgradeServer(args.rootBaseDir, args.rootDataDir);
    return this._upgradeServer.listen(this._messageCenter);
  })
  .then((result) => {
    Helper.appendToLog('* Starting UpgradeScript(' + result + ')');
    return this._upgradeScript.performUpgrade(
      (name) => {
        this._upgradeServer.sendActionName(name);
      },
      (current, total) => {
        this._upgradeServer.sendActionProgress(current, total);
      },
      (text) => {
        this._upgradeServer.sendActionStatus(text);
      }
    );
  })
  .catch((err) => {
    logger.error('Core process|' + Helper.objectToString(err));
  })
  .then(() => this._upgradeScript.finish())
  .then(() => {
    if (this._upgradeServer) {
      logger.debug('Send Reload Command');
      this._upgradeServer.sendActionReload();
    }
    return Promise.resolve();
  })
  .then(() => {
    if (this._upgradeServer) {
      logger.debug('Close Upgrade Server');
      this._upgradeServer.close();
    }
    return Promise.resolve();
  })
  .then(() => UpgradeScript.startBitsServer())
  .then(() => {
    logger.debug('SUCCESS in Core Process');
    process.exit(Environment.get('YARN_INSTALL_ERROR'));
  })
  .catch((err) => {
    logger.debug('FAILURE in Core Process: ', err);
    process.exit(-1);
  });

  function printUsage() {
    console.log('BITS Upgrade Script - usage:');
    console.log('  node app.js -b BASE -d DATA -t TARGET [-h] [-l LEVEL]');
    console.log('where:');
    console.log('  -b BASE: use BASE as the BITS base directory');
    console.log('  -d DATA: use DATA as the BITS data directory');
    console.log('  -t TARGET: use TARGET as the target OMG file');
    console.log('  -h: show this usage text');
    console.log('  -l LEVEL: set log level to LEVEL, where LEVEL is one of:');
    console.log('     error, warn, info, verbose, debug (default is info)');
    process.exit(1);
  }
})();
