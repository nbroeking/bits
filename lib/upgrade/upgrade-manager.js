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

  const semver = require('semver');
  const path = require('path');
  const UtilChildProcess = require('../helpers/child-process');

  const ROOT_DIR = path.resolve(__dirname, '../..');
  const UPGRADE_BASE_CHECK_TIME = (new Date('2017-01-01')).getTime();
  const BASE_UPGRADE_TIMEOUT = 10000;

  class UpgradeManager {
    constructor() {
      this._upgradeBaseCommand = path.resolve('/tmp', 'upgrade-base');
      this._rootDataDir = global.paths.data;
    }

    load(messageCenter) {
      return Promise.resolve()
    }

    unload() {
      return Promise.resolve();
    }

    upgradeBase(filepath) {
      const now = Date.now();
      if (UPGRADE_BASE_CHECK_TIME > now) {
        return Promise.reject(new Error('System time must be updated through BITS Settings'));
      } else {
        return this._runUpgradeBaseScript(filepath);
      }
    }

    _runUpgradeBaseScript(filepath) {
      // First extract the upgrade-base script from the new base
      let extractArgs = [
        'xf', filepath,
        '--no-anchored',
        '--transform', 's/.*\\///g',
        '-C', '/tmp',
        'upgrade-base',
      ];

      let args = [
        this._upgradeBaseCommand,
        '-t', filepath, // The file path to the .tgz file of the base to upgrade with
        '-P', ROOT_DIR,
        '-d', this._rootDataDir,
      ];

      // Create options for the upgrade-base script
      let options = {
        cwd: '/tmp', // upgrade script must run in script directory for linux
      };

      // Spawn the upgrade-base script process
      return UtilChildProcess.createSpawnPromise('tar', extractArgs, options)
      .then((result) => {
        if (0 !== result.code) {
          return Promise.reject(new Error('Failed to extract upgrade-base from tar: ' + result.code));
        }
      })
      .then(() => {
        logger.debug('Extracted the upgrade-base script from %s', filepath);
        logger.debug('Running', args, options);
        return new Promise((resolve, reject) => {
          setTimeout(() => { // If the base upgrade works the node process will die before this fires
            reject('Unknown error with upgrade base timout occured');
          }, BASE_UPGRADE_TIMEOUT);
          return UtilChildProcess.createSpawnPromise('whereis', ['systemd-run'], options)
          .then((result) => {
            let exists = result.stdout.toString().split(/[ ]+/).length;
            if (exists > 1) {
              return this._notifyAndSpawnUpgradeScript({cmd: 'systemd-run', args: args, options: options});
            } else {
              return this._notifyAndSpawnUpgradeScript({cmd: 'setsid', args: args, options: options})
              .then((result) => {
                if (0 === result.code) {
                  // The last output of the script
                  let lastOut = result.stdout[result.stdout.length - 1].trim();
                  // Return the file path to the decrypted module
                  return lastOut;
                } else if (1 === result.code) {
                  return reject(new Error('incorrect arguments supplied'));
                } else if (2 === result.code) {
                  return reject(new Error('base backup failed'));
                } else if (3 === result.code) {
                  return reject(new Error('new base installation failed, aborted new base installation'));
                }
              });
            }
          });
        });
      });
    }

    _notifyAndSpawnUpgradeScript({cmd, args=[], options={}}) {
      return Promise.resolve()
      .then(() => UtilChildProcess.createSpawnPromise(cmd, args, options))
      .then(() => this.emit('upgrade-starting'));
    }
  }

  module.exports = UpgradeManager;
})();
