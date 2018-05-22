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
  const ErrorLog = require('./error-logger');
  const fs = require('fs');
  const Helper = require('./helper');
  const logger = require('./simple-logger');
  const path = require('path');

  class ScriptError extends Error {
    constructor(...args) {
      super(...args);
      Error.captureStackTrace(this, ScriptError);
    }
  }

  class UpgradeScript {
    constructor() {
    }

    // Set up the environment for our script
    // returns a Promise
    static configureEnvironment() {
      return Promise.resolve()
      .then(() => logger.verbose('FUNCTION: configureEnvironment'))
      .then(() => Helper.evalAsPromise('lsb_release', ['-c', '-s']))
      .then((rel) => {
        Environment.set('RELEASE', rel.output.join('\n').trim());
      })
      .then(() => Helper.evalAsPromise('lsb_release', ['-i', '-s']))
      .then((rel2) => Environment.set('DISTRIBUTOR', rel2.output.join('\n').trim().toLowerCase()))
      .then(() => Helper.evalAsPromise('uname', ['-m']))
      .then((arch) => Environment.set('ARCH', arch.output.join('\n').trim()))
      .catch((err) => {
        logger.error('ERROR in configureEnvironment: ' + err);
        return Helper.appendToLog('ERROR in configureEnvironment: ' + err)
        .then(() => ErrorLog.append('Upgrade.configureEnvironment: ' + err))
        .then(() => {
          throw Error('configureEnvironment|' + err);
        });
      });
    }

    performUpgrade(actionName, actionProgress, actionStatus) {
      this._actionName = actionName;
      this._actionProgress = actionProgress;
      this._actionStatus = actionStatus;
      return Promise.resolve()
      .then(() => this._actionStatus('performUpgrade'))
      .then(() => this._actionProgress(0, 100))
      .then(() => this._actionName('Validating OMG'))
      .then(() => this._createBackupDirectory())
      .then(() => this._unpackTarball())
      .then(() => this._loadEnvironment())
      .then(() => this._enumeratePrehookScripts())
      .then(() => this._enumeratePosthookScripts())
      .then(() => this._countProgressItems())
      .then(() => this._actionName('Running Prehook Scripts'))
      .then(() => this._actionProgress(this._startingPrehookScripts, this._totalProgressItems))
      .then(() => this._runPrehookScripts())
      .then(() => this._actionProgress(this._startingClearBackupDir, this._totalProgressItems))
      .then(() => this._clearBackupDirectory())
      .then(() => this._actionName('Installing OMG Files'))
      .then(() => this._actionProgress(this._startingTargetFilesToMove, this._totalProgressItems))
      .then(() => this._moveTargetFilesToBitsDirectory())
      .then(() => this._actionProgress(this._startingRomgModulesAndData, this._totalProgressItems))
      .then(() => this._moveRomgModulesAndData())
      .then(() => this._actionProgress(this._startingCleanupRomgDataDir, this._totalProgressItems))
      .then(() => this._cleanupRomgDataDir())
      .then(() => this._actionProgress(this._startingSetYarnCacheFolder, this._totalProgressItems))
      .then(() => this._setYarnCacheFolder())
      .then(() => this._actionProgress(this._startingRunYarnInstallOnBase, this._totalProgressItems))
      .then(() => this._runYarnInstallOnBase())
      .then(() => this._actionProgress(this._startingRunYarnInstallOnModules, this._totalProgressItems))
      .then(() => this._runYarnInstallOnModules())
      .then(() => this._actionProgress(this._startingUpdatePermissions, this._totalProgressItems))
      .then(() => this._updatePermissions())
      .then(() => this._actionProgress(this._startingInstallInitScripts, this._totalProgressItems))
      .then(() => this._installInitScripts())
      .then(() => this._actionName('Running Posthook Scripts'))
      .then(() => this._actionProgress(this._startingPosthookScripts, this._totalProgressItems))
      .then(() => this._runPosthookScripts())
      .then(() => this._actionName('Installation completed... restarting BITS'))
      .then(() => this._actionProgress(this._totalProgressItems, this._totalProgressItems))
      // finally, catch any errors and finish up
      .catch((err) => {
        Environment.dump('Catch(err) in PerformUpgrade');
        logger.error('PerformUpgrade|' + err);
        return Helper.appendToLog(err)
        .then(() => ErrorLog.append('Upgrade.performUpgrade: ' + err))
        .then(() => {
          throw Error('PerformUpgrade|' + err);
        });
      });
    }

    // //////////////////////////////////////////////////////////////////////////
    // Functions from the script
    // //////////////////////////////////////////////////////////////////////////

    // Trap any exit; perform cleanup
    // returns a Promise
    finish() {
      const upgradeDir = path.join(Environment.get('DATA_DIR'), 'upgrade');
      const latestLink = path.join(upgradeDir, 'latest');
      const logSource = Environment.get('LOG');
      const logBasename = path.basename(logSource);
      const logDest = path.join(upgradeDir, logBasename);
      const errorsLink = path.join(upgradeDir, 'errors');
      const errorLogSource = Environment.get('ERROR_LOG');
      const errorLogBasename = path.basename(errorLogSource);
      const errorLogDest = path.join(upgradeDir, errorLogBasename);

      return Promise.resolve()
      .then(() => logger.verbose('FUNCTION: finish'))
      .then(() => Helper.appendToLog('* INFO Finishing Script'))
      .then(() => this._rm(errorsLink))
      .catch((err) => logger.info('No ' + errorsLink + ' file to delete'))
      .then(() => this._fileExists(errorLogSource))
      .then(() => {
        // we end up here if the ERROR_LOG file exists
        return Promise.resolve()
        .then(() => Helper.appendToLog('* INFO Copying Error Log to data directory as '
          + errorLogBasename))
        .then(() => this._mkdir(upgradeDir))
        .then(() => this._cp(errorLogSource, errorLogDest))
        .then(() => this._rm(errorLogSource))
        .then(() => this._ln(errorLogDest, errorsLink, 'file'))
        .then(() => {
          Environment.set('ERROR_LOG', errorLogDest);
        }) // update the ERROR_LOG file location
        .catch((err) => {
          return Helper.appendToLog('Error copying error log: ' + err)
          .then(() => ErrorLog.append('Upgrade.finish: ' + err))
          .then(() => {
            throw Error('cp UpgradeLog(error)|' + err);
          });
        });
      }, () => {
        // we get here if the LOG file did not exist
        // If needed, do whatever you need to do in order to handle a missing LOG file
      })
      .then(() => this._fileExists(logSource))
      .then(() => {
        // we end up here if the LOG file exists
        return Promise.resolve()
        .then(() => Helper.appendToLog('* INFO Copying Upgrade Log to data directory as '
          + logBasename))
        .then(() => this._mkdir(upgradeDir))
        .then(() => this._cp(logSource, logDest))
        .then(() => this._rm(latestLink))
        .then(() => this._ln(logDest, latestLink, 'file'))
        .then(() => {
          Environment.set('LOG', logDest);
        }) // update the LOG file location
        .catch((err) => {
          return Helper.appendToLog('Error copying upgrade log: ' + err)
          .then(() => ErrorLog.append('Upgrade.finish: ' + err))
          .then(() => {
            throw Error('cp UpgradeLog(log)|' + err);
          });
        });
      }, () => {
        // we get here if the LOG file did not exist
        // If needed, do whatever you need to do in order to handle a missing LOG file
      })
      .then(() => Helper.appendToLog('* INFO cleaning up ' + Environment.get('BACKUP_DIR')))
      .then(() => {
        // only remove backup files if YARN_INSTALL_ERROR is zero
        logger.debug('YARN_INSTALL_ERROR = ' + Environment.get('YARN_INSTALL_ERROR'));
        if (Environment.get('YARN_INSTALL_ERROR') === '0') {
          return Promise.resolve()
          .then(() => this._rmrf(Environment.get('BACKUP_DIR')))
          .catch((err) => {
            return Helper.appendToLog('Error removing backup dir: ' + err)
            .then(() => ErrorLog.append('Upgrade.finish: Error removing backup dir: ' + err))
            .then(() => {
              throw Error('rm backupDir|' + err);
            });
          });
        } else {
          return Promise.resolve();
        }
      })
      .then(() => this._rmrf(Environment.get('BACKUP_DIR')))
      .catch((err) => {
        return Helper.appendToLog('* ERROR in finish(): ' + err)
        .then(() => ErrorLog.append('Upgrade.finish: ' + err))
        .then(() => {
          throw Error('finish|' + err);
        });
      })
      .then(() => {
        logger.verbose('UpgradeScript: --finish');
      });
    }

    // aborting the process
    abort(comment) {
      if (comment) {
        logger.error('ABORT: ' + comment + '\n');
      }
      return Promise.resolve()
      .then(() => this._actionStatus('abort: ' + comment))
      .then(() => Helper.appendToLog('* INFO Aborting Script'))
      .then(() => Helper.evalAsPromise('cp', ['-r', Environment.get('BACKUP_DIR') + '/backup', Environment.get('BASE_DIR')]))
      .catch((err) => {
        logger.error('ERROR in abort(): ' + err);
        return Helper.appendToLog('* ERROR in abort(): ' + err)
        .then(() => ErrorLog.append('Upgrade.abort: ' + err))
        .then(() => {
          throw Error('abort|' + err);
        });
      })
      .then(() => Promise.reject(Error(comment + '|Abort, exit code 2')));
    }

    // Run install from the given directory
    // returns a Promise
    runInstall(installDir) {
      const tempEnv = Object.assign({HOME: '/root'}, Environment.all);
      const options = {cwd: installDir, env: tempEnv};
      let packageJsonExists = false;
      let grepSucceded = false;

      return Promise.resolve()
      .then(() => this._actionStatus('runInstall(' + path.basename(installDir) +')'))
      // verify that package.json exists
      .then(() => this._fileExists(path.join(installDir, 'package.json')))
      .then(() => {
        logger.debug('package.json exists');
        packageJsonExists = true;
      }, () => {
        logger.debug('package.json does not exist');
        packageJsonExists = false;
      })
      // verify that we can run bits:install
      .then(() => {
        if (packageJsonExists) {
          return Promise.resolve()
          .then(() => Helper.evalAsPromise('grep', ['-q', '"bits:install" *:', 'package.json'], options));
        }
        return Promise.reject();
      })
      .then((results) => {
        grepSucceded = (results.code === 0);
        if (grepSucceded) {
          logger.debug('grep passed (found bits:install)');
        } else {
          logger.debug('grep ran but failed (no bits:install)');
        }
      }, (err) => {
        if (err) {
          logger.debug('grep failed to run: ' + err);
          grepSucceded = false;
          return ErrorLog.append('Upgrade.runInstall: grep failed to run: ' + err);
        }
      })
      .then(() => {
        if (packageJsonExists && grepSucceded) {
          return Promise.resolve()
          .then(() => logger.debug('npm run bits:install'))
          .then(() => Helper.evalAsPromise(
            'npm',
            ['run', 'bits:install'],
            options))
          .then((results) => {
            return Promise.resolve()
            .then(() => Helper.appendToLog('Install status = ' + results.code + ' in ' + path.basename(installDir)))
            .then(() => results);
          }, (err) => {
            return Helper.appendToLog('Error in bits:install: ' + err)
            .then(() => ErrorLog.append('Upgrade.runInstall: ' + err))
            .then(() => {
              throw Error('bits:install|' + err);
            });
          });
        } else {
          return Promise.resolve()
          .then(() => Helper.appendToLog('No package.json or no bits:install script command in ' + path.basename(installDir)))
          .then(() => {
            code: 0;
          });
        }
      });
    }

    // Stop the BITS server
    // returns a Promise
    static stopBitsServer() {
      const whoami = Helper.whoami();
      const release = Environment.get('RELEASE');

      logger.debug('Stop BITS Server');
      if (whoami === 'root') {
        if (release === 'xenial') {
          // stop BITS as root user on xenial
          return Promise.resolve()
          .then(() => Helper.appendToLog('* Stopping the systemctl bits process'))
          .then(() => Helper.evalAsPromise('systemctl', ['stop', 'bits'], {}))
          .then((results) => Helper.appendToLog('Report: ' + results.code),
            (err) => {
              return Helper.appendToLog('Error stopping bits: ' + err)
              .then(() => ErrorLog.append('Upgrade.stopBitsServer: ' + err))
              .then(() => {
                throw Error('bits stop|' + err);
              });
            });
        } else if (release === 'trusty') {
          // stop BITS as root user on trusty
          return Promise.resolve()
          .then(() => Helper.appendToLog('* Stopping the upstart bits process'))
          .then(() => Helper.evalAsPromise('service', ['bits', 'stop']))
          .then((results) => Helper.appendToLog('Report: ' + results.code),
            (err) => {
              return Helper.appendToLog('Error stopping bits: ' + err)
              .then(() => ErrorLog.append('Upgrade.stopBitsServer: ' + err))
              .then(() => {
                throw Error('bits stop|' + err);
              });
            });
        } else {
          // unsupported platform
          return Promise.resolve()
          .then(() => Helper.appendToLog('* ' + release + ' not supported'))
          .then(() => {
            return ErrorLog.append('Upgrade.stopBitsServer: ' + 'Platform "' + release + '" is not supported')
            .then(() => {
              throw Error('Platform "' + release + '" is not supported');
            });
          });
        }
      } else {
        // not root... we cannot continue
        return Promise.resolve()
        .then(() => Helper.appendToLog('* Not stopping the bits process: must be root user (currently "' + whoami + '")'))
        .then(() => {
          return ErrorLog.append('Upgrade.stopBitsServer: ' + 'Must be root user (currently "' + whoami + '")')
          .then(() => {
            throw Error('Must be root user (currently "' + whoami + '")');
          });
        });
      }
    }

    // Start BITS server
    // returns a Promise
    static startBitsServer() {
      const whoami = Helper.whoami();
      const release = Environment.get('RELEASE');

      logger.debug('Start BITS Server');

      if ((release === 'xenial') && (whoami === 'root')) {
        return Promise.resolve()
        .then(() => logger.verbose('FUNCTION: startBitsServer (xenial as root)'))
        // systemctl status bits >> "${LOG}" 2>&1
        .then(() => Helper.evalAsPromise('systemctl', ['status', 'bits']))
        .then((results) => {
          return Helper.appendIndentedResultsToLog(results, 'BITS service status:');
        }, (err) => {
          logger.error('Error getting status: ', err);
          return ErrorLog.append('Upgrade.startBitsServer: getting status: ' + err);
        })
        // systemctl disable bits.service >> "${LOG}" 2>&1
        .then(() => Helper.evalAsPromise('systemctl', ['disable', 'bits.service']))
        .then((results) => {
          return Helper.appendIndentedResultsToLog(results, 'Disable BITS service:');
        }, (err) => {
          logger.error('Error disabling BITS: ', err);
          return ErrorLog.append('Upgrade.startBitsServer: disabling BITS: ' + err);
        })
        // systemctl daemon-reload >> "${LOG}" 2>&1
        .then(() => Helper.evalAsPromise('systemctl', ['daemon-reload']))
        .then((results) => {
          return Helper.appendIndentedResultsToLog(results, 'Reload daemons:');
        }, (err) => {
          logger.error('Error reloading: ', err);
          return ErrorLog.append('Upgrade.startBitsServer: reloading: ' + err);
        })
        // systemctl enable bits.service >> "${LOG}" 2>&1
        .then(() => Helper.evalAsPromise('systemctl', ['enable', 'bits.service']))
        .then((results) => {
          return Helper.appendIndentedResultsToLog(results, 'Enable BITS service:');
        }, (err) => {
          logger.error('Error enabling: ', err);
          return ErrorLog.append('Upgrade.startBitsServer: enabling: ' + err);
        })
        // systemctl daemon-reload >> "${LOG}" 2>&1
        .then(() => Helper.evalAsPromise('systemctl', ['daemon-reload']))
        .then((results) => {
          return Helper.appendIndentedResultsToLog(results, 'Reload daemons:');
        }, (err) => {
          logger.error('Error reloading 2: ', err);
          return ErrorLog.append('Upgrade.startBitsServer: reloading 2: ' + err);
        })
        // systemctl start bits >> "${LOG}" 2>&1
        .then(() => Helper.evalAsPromise('systemctl', ['start', 'bits']))
        .then((results) => {
          return Helper.appendIndentedResultsToLog(results, 'Start BITS service:');
        }, (err) => {
          logger.error('Error starting: ', err);
          return ErrorLog.append('Upgrade.startBitsServer: starting: ' + err);
        })
        // systemctl status bits >> "${LOG}" 2>&1
        .then(() => Helper.evalAsPromise('systemctl', ['status', 'bits']))
        .then((results) => {
          return Helper.appendIndentedResultsToLog(results, 'BITS service status:');
        }, (err) => {
          logger.error('Error getting status 2: ', err);
          return ErrorLog.append('Upgrade.startBitsServer: getting status 2: ' + err);
        })
        .then(() => {
          logger.debug('SUCCESS in startBitsServer');
        }, (err) => {
          logger.debug('FAILURE in startBitsServer');
          return ErrorLog.append('Upgrade.startBitsServer: failure: ' + err);
          throw err;
        });
      } else if ((release === 'trusty') && (whoami === 'root')) {
        return Promise.resolve()
        .then(() => logger.verbose('FUNCTION: startBitsServer (trusty as root)'))
        // service bits start >> "${LOG}" 2>&1
        .then(() => Helper.evalAsPromise('service', ['bits', 'start']))
        .then((results) => {
          return Helper.appendIndentedResultsToLog(results, 'Start BITS service:');
        }, (err) => {
          return Helper.appendToLog('Error starting bits: ' + err)
          .then(() => ErrorLog.append('Upgrade.startBitsServer: starting bits: ' + err))
          .then(() => {
            throw Error('bits start|' + err);
          });
        })
        .then(() => {
          logger.debug('SUCCESS in startBitsServer');
        }, (err) => {
          logger.debug('FAILURE in startBitsServer');
          return ErrorLog.append('Upgrade.startBitsServer: ' + err)
          .then(() => {
            throw err;
          });
        });
      }
    }

    _createBackupDirectory() {
      return Promise.resolve()
      .then(() => this._actionStatus('_createBackupDirectory'))
      .then(() => Helper.appendToLog('* Creating the backup directory'))
      .then(() => this._mkdir(Environment.get('BACKUP_DIR')),
        (err) => {
          return Helper.appendToLog('Error creating backup dir: ' + err)
          .then(() => ErrorLog.append('Upgrade._createBackupDirectory: ' + err))
          .then(() => {
            throw Error('_createBackupDirectory|' + err);
          });
        });
    }

    _unpackTarball() {
      return Promise.resolve()
      .then(() => this._actionStatus('_unpackTarball'))
      .then(() => Helper.appendToLog('* Unpacking the new base'))
      .then(() => this._mkdir(Environment.get('TARGET_EXTRACT')))
      .catch((err) => {
        return Helper.appendToLog('Error making extract dir: ' + err)
        .then(() => ErrorLog.append('Upgrade._unpackTarball: ' + err))
        .then(() => {
          throw Error('_unpackTarball|' + err);
        });
      })
      .then(() => Helper.appendToLog(Environment.get('TARGET') + ' -C ' + Environment.get('TARGET_EXTRACT')))
      .then(() => Helper.evalAsPromise('tar', ['-xzf', Environment.get('TARGET'), '-C', Environment.get('TARGET_EXTRACT')]))
      .then((results) => {
        // results.output contains the TAR command output to go into the log file
        let p = Promise.resolve();
        if (results.code != 0) {
          // tar command failed (non-zero return code)
          p = p.then(() => Helper.appendToLog('* ERROR Failed to untar ' + Environment.get('TARGET')))
          .then(() => Helper.appendToLog('* Original Target: ' + Environment.get('TARGET')))
          .catch((err) => {
            return Helper.appendToLog('Error untarring: ' + err)
            .then(() => ErrorLog.append('Upgrade._unpackTarball: untar: ' + err))
            .then(() => {
              throw Error('_unpackTarball|' + err);
            });
          })
          .then(() => {
            logger.error(Helper.objectToString(results));
            return Helper.appendIndentedResultsToLog(results, 'TAR OUTPUT:')
            .then(() => {
              return ErrorLog.append('Upgrade._unpackTarball: untar 2: ' + Helper.objectToString(results))
              .then(() => ErrorLog.appendIndentedResults(results))
              .then(() => {
                throw new ScriptError('untar failed');
              });
            });
          });
        }
        return p;
      }, (err) => {
        // tar command failed
        return Promise.resolve()
        .then(() => Helper.appendToLog('* ERROR Failed to untar ' + Environment.get('TARGET')))
        .then(() => Helper.appendToLog('* Original Target: ' + Environment.get('TARGET')))
        .then(() => ErrorLog.append('Upgrade._unpackTarball: ERROR Failed to untar ' + Environment.get('TARGET')))
        .then(() => ErrorLog.append('Upgrade._unpackTarball: Original Target: ' + Environment.get('TARGET')))
        .then(() => {
          throw new ScriptError('untar failed|' + err);
        });
      })
      .then(() => Helper.appendToLog('* INFO extracted the new bits'));
    }

    _loadEnvironment() {
      return Environment.load(path.join(Environment.get('TARGET_EXTRACT'), 'support/scripts/prehooks/.env'));
    }

    _enumeratePrehookScripts() {
      // if there is a .../support/scripts/prehooks folder, add the names of
      // those scripts to our _prehookScripts array
      this._prehookScripts = []; // start with an empty array
      const scriptPath = path.join(Environment.get('TARGET_EXTRACT'), 'support/scripts/prehooks');
      return Promise.resolve()
      .then(() => this._actionStatus('_enumeratePrehookScripts'))
      .then(() => this._readDir(scriptPath))
      .then((files) => {
        this._prehookScripts = files
        .filter((item) => (item.charAt(0) != '.'));
        return Promise.resolve();
      }, (err) => {
        return Promise.resolve()
        .then(() => Helper.appendToLog('Error reading extract dir: ' + err))
        .then(() => ErrorLog.append('Upgrade._enumeratePrehookScripts: reading extract dir: ' + err))
        .then(() => {
          throw Error('_enumeratePrehookScripts|' + err);
        });
      })
      .then(() => logger.debug('Prehook scripts: ' + this._prehookScripts));
    }

    _enumeratePosthookScripts() {
      // if there is a .../support/scripts/posthooks folder, add the
      // names of those scripts to our _posthookScripts array
      this._posthookScripts = []; // start with an empty array
      const scriptPath = path.join(Environment.get('TARGET_EXTRACT'), 'support/scripts/posthooks');
      return Promise.resolve()
      .then(() => this._actionStatus('_enumeratePosthookScripts'))
      .then(() => this._readDir(scriptPath))
      .then((files) => {
        this._posthookScripts = files
        .filter((item) => (item.charAt(0) != '.'));
        return Promise.resolve();
      }, (err) => {
        return Promise.resolve()
        .then(() => Helper.appendToLog('Error reading extract dir: ' + err))
        .then(() => ErrorLog.append('Upgrade._enumeratePosthookScripts: reading extract dir: ' + err))
        .then(() => {
          throw Error('_enumeratePosthookScripts|' + err);
        });
      })
      .then(() => logger.debug('Posthook scripts: ' + this._posthookScripts));
    }

    _countPrehookScripts() {
      this._startingPrehookScripts = this._totalProgressItems;
      this._totalProgressItems += this._prehookScripts.length;
    }

    _runPrehookScripts() {
      const scriptPath = path.join(Environment.get('TARGET_EXTRACT'), 'support/scripts/prehooks');
      const options = {cwd: scriptPath, env: Environment.all};

      return Promise.resolve()
      .then(() => this._actionStatus('_runPrehookScripts'))
      .then(() => {
        return this._prehookScripts
        .reduce((prom, file) => {
          return prom.then(() => {
            return Promise.resolve()
            .then(() => this._actionStatus('Prehook ' + file))
            .then(() => Helper.appendToLog('* INFO running Prehook script ' + file))
            .then(() => Helper.evalAsPromise(path.join(scriptPath, file), [], options))
            .then((results) => {
              if (results.code === 0) {
                return Promise.resolve()
                .then(() => Helper.appendToLog('The script PASSED (exit code 0)'))
                .then(() => results);
              } else {
                return Promise.resolve()
                .then(() => Helper.appendToLog('The script FAILED (exit code ' + results.code + ')'))
                .then(() => ErrorLog.append('Upgrade._runPrehookScripts: Prehook script (' + file + ') failed (' + results.code + ')'))
                .then(() => ErrorLog.appendIndentedResults(results))
                .then(() => results);
              }
            })
            .then((results) => Helper.appendIndentedResultsToLog(results, 'Output from ' + file + ':'))
            .then(() => this._actionProgress(++this._startingPrehookScripts, this._totalProgressItems));
          });
        }, Promise.resolve());
      });
    }

    _countPosthookScripts() {
      this._startingPosthookScripts = this._totalProgressItems;
      this._totalProgressItems += this._posthookScripts.length;
    }

    _runPosthookScripts() {
      const scriptPath = path.join(Environment.get('BASE_DIR'), 'support/scripts/posthooks');
      const options = {cwd: scriptPath, env: Environment.all};

      return Promise.resolve()
      .then(() => this._actionStatus('_runPosthookScripts'))
      .then(() => {
        return this._posthookScripts
        .reduce((prom, file) => {
          return prom.then(() => {
            return Promise.resolve()
            .then(() => this._actionStatus('Posthook ' + file))
            .then(() => Helper.appendToLog('* INFO running Posthook script ' + file))
            .then(() => Helper.evalAsPromise(path.join(scriptPath, file), [], options))
            .then((results) => {
              if (results.code === 0) {
                return Promise.resolve()
                .then(() => Helper.appendToLog('The script PASSED (exit code 0)'))
                .then(() => results);
              } else {
                return Promise.resolve()
                .then(() => Helper.appendToLog('The script FAILED (exit code ' + results.code + ')'))
                .then(() => ErrorLog.append('Upgrade._runPosthookScripts: Posthook script (' + file + ') failed (' + results.code + ')'))
                .then(() => ErrorLog.appendIndentedResults(results))
                .then(() => results);
              }
            })
            .then((results) => {
              return Helper.appendIndentedResultsToLog(results, 'Output from ' + file + ':');
            })
            .then(() => this._actionProgress(++this._startingPosthookScripts, this._totalProgressItems));
          });
        }, Promise.resolve());
      });
    }

    _countClearBackupDir() {
      this._startingClearBackupDir = this._totalProgressItems;
      this._totalProgressItems += 1; // mkdir
      return Promise.resolve()
      .then(() => this._countFiles(
        Environment.get('BASE_DIR'),
        ['', '.', '..', path.basename(Environment.get('BACKUP_DIR'))]))
      .then((count) => {
        this._totalProgressItems += count;
      });
    }

    _clearBackupDirectory() {
      const backupDir = path.join(Environment.get('BACKUP_DIR'), 'backup');
      return Promise.resolve()
      .then(() => this._actionStatus('_clearBackupDirectory'))
      .then(() => this._mkdir(backupDir))
      .then(() => this._actionProgress(++this._startingClearBackupDir, this._totalProgressItems))
      .catch((err) => {
        logger.error('ERROR in mkdir: ' + err);
      })
      .then(() => logger.debug('Move files from ' + Environment.get('BASE_DIR') + ' to ' + backupDir))
      .then(() => this._move(
        Environment.get('BASE_DIR'),
        backupDir,
        false))
      .catch((err) => {
        return Helper.appendToLog('Error moving files: ' + err)
        .then(() => ErrorLog.append('Upgrade._clearBackupDirectory: moving files: ' + err))
        .then(() => {
          throw Error('_clearBackupDirectory|' + err);
        });
      })
      .then(() => this._actionProgress(++this._startingClearBackupDir, this._totalProgressItems))
      .then(() => this._readDir(Environment.get('BASE_DIR')))
      .then((files) => {
        if (files.length != 1) {
          logger.debug('_clearBackupDirectory: # files = ' + files.length);
          return Promise.resolve()
          .then(() => Helper.appendToLog('* ERROR Failed to clear ' + Environment.get('BASE_DIR')))
          .then(() => Helper.appendToLog('FILES:\n' + files.sort().join('\n')))
          .then(() => ErrorLog.append('Upgrade._clearBackupDirectory: Failed to clear ' + Environment.get('BASE_DIR')))
          .then(() => ErrorLog.append('Upgrade._clearBackupDirectory: FILES:\n' + files.sort().join('\n')))
          .then(() => this.abort('_clearBackupDirectory'));
        }
        return Promise.resolve();
      }, (err) => {
        return Helper.appendToLog('Error reading baseDir: ' + err)
        .then(() => ErrorLog.append('Upgrade._clearBackupDirectory: reading baseDir: ' + err))
        .then(() => {
          throw Error('_clearBackupDirectory|' + err);
        });
      });
    }

    _countTargetFilesToMove() {
      this._startingTargetFilesToMove = this._totalProgressItems;
      return Promise.resolve()
      .then(() => this._countFiles(
        Environment.get('TARGET_EXTRACT'),
        ['', '.', '..']))
      .then((count) => {
        this._totalProgressItems += count;
      });
    }

    _moveTargetFilesToBitsDirectory() {
      return Promise.resolve()
      .then(() => this._actionStatus('_moveTargetFilesToBitsDirectory'))
      .then(() => Helper.appendToLog('* INFO moving the new bits'))
      .then(() => this._move(
        Environment.get('TARGET_EXTRACT'),
        Environment.get('BASE_DIR'),
        false))
      .then(() => this._actionProgress(++this._startingTargetFilesToMove, this._totalProgressItems))
      .then(() => Helper.appendToLog('* INFO moved bits into place'))
      .catch((err) => {
        return Promise.resolve()
        .then(() => Helper.appendToLog('* ERROR Failed to install '
                  + Environment.get('TARGET_EXTRACT') + ': ' + err))
        .then(() => ErrorLog.append('Scirpt._moveTargetFilesToBitsDirectory: Failed to install '
                  + Environment.get('TARGET_EXTRACT') + ': ' + err))
        .then(() => this.abort('_moveTargetFilesToBitsDirectory'));
      });
    }

    _countRomgModulesAndData() {
      const modulesDir = path.join(Environment.get('TARGET_EXTRACT'), 'data/base/modules/modules');
      const dataDir = path.join(Environment.get('TARGET_EXTRACT'), 'data');
      const skipDir = path.join(Environment.get('TARGET_EXTRACT'), 'data/base');

      this._startingRomgModulesAndData = this._totalProgressItems;
      this._totalProgressItems += 3; // dirExists + rm + move
      return Promise.resolve()
      .then(() => this._countFiles(
        modulesDir,
        ['', '.', '..']))
      .then((count) => {
        this._totalProgressItems += count;
      })
      .then(() => this._countFiles(
        dataDir,
        ['', '.', '..', skipDir]))
      .then((count) => {
        this._totalProgressItems += count;
      });
    }

    _moveRomgModulesAndData() {
      const baseDataDir = path.join(Environment.get('BASE_DIR'), 'data');
      const skipDir = path.join(Environment.get('BASE_DIR'), 'data/base');
      const baseDir = path.join(Environment.get('BASE_DIR'), 'data/base/modules/modules');

      return Promise.resolve()
      .then(() => this._actionStatus('_moveRomgModulesAndData'))
      .then(() => this._dirExists(baseDir))
      .then(() => {
        const modulesDir = path.join(Environment.get('DATA_DIR'), 'base/modules/modules');
        return Promise.resolve()
        .then(() => Helper.appendToLog('* INFO copying omg modules'))
        .then(() => this._mkdir(modulesDir))
        .catch((err) => {
          return Helper.appendToLog('Error in omg copy: ' + err)
          .then(() => ErrorLog.append('Upgrade._moveRomgModulesAndData: omg copy: ' + err));
        })
        // clean up old modules
        .then(() => this._rmrf(path.join(modulesDir, '*')))
        .catch((err) => {
          return Helper.appendToLog('Error in rmrf(' + modulesDir + '/*): ' + err)
          .then(() => ErrorLog.append('Upgrade._moveRomgModulesAndData: rmrf: ' + err));
        })
        .then(() => this._actionProgress(++this._startingRomgModulesAndData, this._totalProgressItems))
        // install new modules
        .then(() => this._move(
          baseDir,
          modulesDir,
          false))
        .then((results) => Helper.appendIndentedResultsToLog(results, '_move results:'),
          (err) => {
            return Helper.appendToLog('Error in move (*): ' + err)
            .then(() => ErrorLog.append('Upgrade._moveRomgModulesAndData: mv: ' + err));
          })
        .then(() => this._actionProgress(++this._startingRomgModulesAndData, this._totalProgressItems))
        .then(() => this._readDir(baseDataDir))
        .then((directories) => {
          return directories
          .filter((moduleDataDir) => (moduleDataDir != skipDir))
          .reduce((prom, moduleDataDir) => {
            return prom.then(() => {
              return Promise.resolve()
              .then(() => logger.verbose('MODULE_DATA_DIR: ' + path.join(baseDataDir, moduleDataDir)))
              .then(() => Helper.appendToLog('* INFO copying prepopulated module data for ' +
                    path.basename(moduleDataDir)))
              .then(() => Helper.evalAsPromise(
                'cp',
                [
                  '-a',
                  path.join(baseDataDir, moduleDataDir),
                  modulesDir + '/'
                ]))
              .then((results) => Helper.appendIndentedResultsToLog(results, 'cp results:'),
                (err) => {
                  return Helper.appendToLog('Error in cp: ' + err)
                  .then(() => ErrorLog.append('Upgrade._moveRomgModulesAndData: cp: ' + err));
                })
              .then(() => this._actionProgress(++this._startingRomgModulesAndData, this._totalProgressItems));
            });
          }, Promise.resolve());
        });
      }, () => {/* else dir (BASE_DIR/data/base/modules/modules) does not exist */});
    }

    _countCleanupRomgDataDir() {
      this._startingCleanupRomgDataDir = this._totalProgressItems;
      this._totalProgressItems += 1; // rm
    }

    _cleanupRomgDataDir() {
      const baseDataDir = path.join(Environment.get('BASE_DIR'), 'data');
      return Promise.resolve()
      .then(() => this._actionStatus('_cleanupRomgDataDir'))
      .then(() => {
        if (baseDataDir != Environment.get('DATA_DIR')) {
          return this._rmrf(baseDataDir)
          .catch((err) => {
            return Helper.appendToLog('Error removing files from baseDataDir: ' + err)
            .then(() => ErrorLog.append('Upgrade._cleanupRomgDataDir: ' + err))
            .then(() => {
              throw Error('_cleanupRomgDataDir|' + err);
            });
          });
        } else {
          return Promise.resolve();
        }
      });
    }

    _countSetYarnCacheFolder() {
      this._startingSetYarnCacheFolder = this._totalProgressItems;
      this._totalProgressItems += 4; // rm + mkdir + yarn + yarn
    }

    _setYarnCacheFolder() {
      const possibleYarnCachePaths = [
        path.join(Environment.get('TARGET_EXTRACT'), 'support/yarn-cache'),
        path.join(Environment.get('DATA_DIR'), 'yarn-cache'),
        path.join(Environment.get('BASE_DIR'), 'support/yarn-cache'),
      ];
      let yarnCachePath = '';
      for (let i = 0; i < possibleYarnCachePaths.length; i++) {
        if (fs.existsSync(possibleYarnCachePaths[i])) {
          yarnCachePath = possibleYarnCachePaths[i];
          Helper.appendToLog('Yarn cache found: ' + yarnCachePath);
        }
      }
      Environment.set('YARN_CACHE_FOLDER', yarnCachePath);

      const yarnCacheFolder = Environment.get('YARN_CACHE_FOLDER');
      return Promise.resolve()
      .then(() => this._actionStatus('_setYarnCacheFolder'))
      // yarn config set cache-folder "${YARN_CACHE_FOLDER}" >> "${LOG}" 2>&1
      .then(() => Helper.evalAsPromise('yarn', ['config', 'set', 'cache-folder', yarnCacheFolder]))
      .then((results) => {
        return Helper.appendIndentedResultsToLog(results, 'yarn config set cache-folder results:');
      }, (err) => {
        return Helper.appendToLog('Error in yarn config set cache-folder: ' + err)
        .then(() => ErrorLog.append('Upgrade._setYarnCacheFolder: ' + err))
        .then(() => {
          throw Error('_setYarnCacheFolder|' + err);
        });
      })
      .then(() => this._actionProgress(++this._startingSetYarnCacheFolder, this._totalProgressItems))
      // yarn config list >> "${LOG}" 2>&1
      .then(() => Helper.evalAsPromise('yarn', ['config', 'list']))
      .then((results) => {
        return Helper.appendIndentedResultsToLog(results, 'yarn config list results:');
      }, (err) => {
        return Helper.appendToLog('Error in yarn config list: ' + err)
        .then(() => ErrorLog.append('Upgrade._setYarnCacheFolder: ' + err))
        .then(() => {
          throw Error('_setYarnCacheFolder|' + err);
        });
      });
    }

    _countRunYarnInstallOnBase() {
      this._startingRunYarnInstallOnBase = this._totalProgressItems;
      this._totalProgressItems += 1;
    }

    _runYarnInstallOnBase() {
      const yarnDir = Environment.get('BASE_DIR');
      return Promise.resolve()
      .then(() => this._actionStatus('_runYarnInstallOnBase'))
      // runInstall "${BASE_DIR}"
      .then(() => this.runInstall(yarnDir))
      // if [ $? -ne 0 ]; then
      //   echo "$(date +%H:%M:%S) * ERROR yarn install error" >> "${LOG}" 2>&1
      //   YARN_INSTALL_ERROR=8
      // fi
      .then((results) => {
        logger.debug('_runYarnInstallOnBase: results = ' + results);
        if (results && (results.code != 0)) {
          return Promise.resolve()
          .then(() => Helper.appendToLog('* ERROR yarn install error (' + yarnDir + ')'))
          .then(() => ErrorLog.append('Upgrade._runYarnInstallOnBase: ' + results.code))
          .then(() => {
            Environment.set('YARN_INSTALL_ERROR', 8);
          });
        } else {
          return Promise.resolve();
        }
      }, (err) => {
        return Helper.appendToLog('Error in _runYarnInstallOnBase: ' + err)
        .then(() => ErrorLog.append('Upgrade._runYarnInstallOnBase: ' + err))
        .then(() => {
          throw Error('_runYarnInstallOnBase|' + err);
        });
      });
    }

    _countRunYarnInstallOnModules() {
      const moduleDir = path.join(Environment.get('DATA_DIR'), 'base/modules/modules');

      this._startingRunYarnInstallOnModules = this._totalProgressItems;
      return Promise.resolve()
      .then(() => this._countFiles(
        moduleDir,
        ['', '.', '..']))
      .then((count) => {
        this._totalProgressItems += count;
      });
    }

    _runYarnInstallOnModules() {
      const moduleDir = path.join(Environment.get('DATA_DIR'), 'base/modules/modules');

      return Promise.resolve()
      .then(() => this._actionStatus('_runYarnInstallOnModules'))
      // for MODULE_DIR in "${DATA_DIR}/base/modules/modules"/*; do
      .then(() => this._readDir(moduleDir))
      .then((directories) => {
        return directories.reduce((prom, dir) => {
          return prom.then(() => {
            const yarnDir = path.join(moduleDir, dir);
            return Promise.resolve()
            //   runInstall "${MODULE_DIR}"
            .then(() => this.runInstall(yarnDir))
            //   if [ $? -ne 0 ]; then
            //     echo "$(date +%H:%M:%S) * ERROR yarn module install error" >> "${LOG}" 2>&1
            //     YARN_INSTALL_ERROR=8
            //   fi
            .then((results) => {
              logger.debug('_runYarnInstallOnModules: results = ' + results);
              if (results && (results.code != 0)) {
                return Promise.resolve()
                .then(() => Helper.appendToLog('* ERROR yarn module install error (' + yarnDir + ')'))
                .then(() => ErrorLog.append('Upgrade._runYarnInstallOnModules(' + yarnDir + '): ' + results.code))
                .then(() => {
                  Environment.set('YARN_INSTALL_ERROR', 8);
                });
              } else {
                return Promise.resolve()
                .then(() => {
                  this._actionProgress(++this._startingRunYarnInstallOnModules, this._totalProgressItems);
                });
              }
            }, (err) => {
              return Helper.appendToLog('Error in _runYarnInstallOnModules(' + yarnDir + '): ' + err)
              .then(() => ErrorLog.append('Upgrade._runYarnInstallOnModules(' + yarnDir + '): ' + err))
              .then(() => {
                throw Error('_runYarnInstallOnModules|' + err);
              });
            });
          });
        }, Promise.resolve());
      }, (err) => {
        return Helper.appendToLog('Error in _runYarnInstallOnModules(' + yarnDir + '): ' + err)
        .then(() => ErrorLog.append('Upgrade._runYarnInstallOnModules(' + yarnDir + '): ' + err))
        .then(() => {
          throw Error('_runYarnInstallOnModules|' + err);
        });
      });
    }

    _countUpdatePermissions() {
      this._startingUpdatePermissions = this._totalProgressItems;
      this._totalProgressItems += 4; // chown * 2, chmod * 2
    }

    _updatePermissions() {
      const baseDir = Environment.get('BASE_DIR');
      const dataDir = Environment.get('DATA_DIR');

      return Promise.resolve()
      .then(() => this._actionStatus('_updatePermissions'))
      // echo "$(date +%H:%M:%S) * INFO updating bits and data dir permissions" >> "${LOG}" 2>&1
      .then(() => Helper.appendToLog('* INFO updating bits and data dir permissions'))
      // #Secure /opt/bits OD
      // chown -R root:root "${BASE_DIR}" >> "${LOG}" 2>&1
      .then(() => Helper.evalAsPromise('chown', ['-R', 'root:root', baseDir]))
      .then((results) => {
        return Helper.appendIndentedResultsToLog(results, 'chown -R root:root ' + baseDir + ' results:');
      }, (err) => {
        return Helper.appendToLog('Error in chown baseDir: ' + err)
        .then(() => ErrorLog.append('Upgrade._updatePermissions(chown baseDir): ' + err))
        .then(() => {
          throw Error('_updatePermissions|' + err);
        });
      })
      .then(() => this._actionProgress(++this._startingUpdatePermissions, this._totalProgressItems))
      // chmod -R g-w,g-x,g-r,o-w,o-x,o-r "${BASE_DIR}" >> "${LOG}" 2>&1
      .then(() => Helper.evalAsPromise('chmod', ['-R', 'g-w,g-x,g-r,o-w,o-x,o-r', baseDir]))
      .then((results) => {
        return Helper.appendIndentedResultsToLog(results, 'chmod -R ... ' + baseDir + 'results:');
      }, (err) => {
        return Helper.appendToLog('Error in chmod baseDir: ' + err)
        .then(() => ErrorLog.append('Upgrade._updatePermissions(chmod baseDir): ' + err))
        .then(() => {
          throw Error('_updatePermissions|' + err);
        });
      })
      .then(() => this._actionProgress(++this._startingUpdatePermissions, this._totalProgressItems))
      // #Secure /var/bits OD
      // chown -R root:root "${DATA_DIR}" >> "${LOG}" 2>&1
      .then(() => Helper.evalAsPromise('chown', ['-R', 'root:root', dataDir]))
      .then((results) => {
        return Helper.appendIndentedResultsToLog(results, 'chown -R root:root ' + dataDir + ' results:');
      }, (err) => {
        return Helper.appendToLog('Error in chown dataDir: ' + err)
        .then(() => ErrorLog.append('Upgrade._updatePermissions(chown dataDir): ' + err))
        .then(() => {
          throw Error('_updatePermissions|' + err);
        });
      })
      .then(() => this._actionProgress(++this._startingUpdatePermissions, this._totalProgressItems))
      // chmod -R g-w,g-x,g-r,o-w,o-x,o-r "${DATA_DIR}" >> "${LOG}" 2>&1
      .then(() => Helper.evalAsPromise('chmod', ['-R', 'g-w,g-x,g-r,o-w,o-x,o-r', dataDir]))
      .then((results) => {
        return Helper.appendIndentedResultsToLog(results, 'chmod -R ... ' + dataDir + 'results:');
      }, (err) => {
        return Helper.appendToLog('Error in chmod dataDir: ' + err)
        .then(() => ErrorLog.append('Upgrade._updatePermissions(chmod dataDir): ' + err))
        .then(() => {
          throw Error('_updatePermissions|' + err);
        });
      });
    }

    _countInstallInitScripts() {
      this._startingInstallInitScripts = this._totalProgressItems;
      this._totalProgressItems += 2; // cp + chown
    }

    _installInitScripts() {
      const whoami = Helper.whoami();
      const release = Environment.get('RELEASE');
      let msg;
      let src;
      let dst;

      if ((release === 'xenial') && (whoami === 'root')) {
        msg = 'Installing ubuntu 16 init scripts';
        src = path.join(Environment.get('BASE_DIR'), 'support/systemd/bits.service');
        dst = '/lib/systemd/system/bits.service';
      } else if ((release === 'trusty') && (whoami === 'root')) {
        msg = 'Installing ubuntu 14 init scripts';
        src = path.join(Environment.get('BASE_DIR'), 'support/upstart/bits.conf');
        dst = '/etc/init/bits.conf';
      }

      return Promise.resolve()
      .then(() => this._actionStatus('_installInitScripts'))
      .then(() => Helper.appendToLog(msg))
      .then(() => Helper.evalAsPromise('cp', ['-v', src, dst]))
      .then((results) => {
        return Helper.appendIndentedResultsToLog(results, 'cp -v ' + src + ' ' + dst + 'results:');
      }, (err) => {
        return Helper.appendToLog('Error copying files: ' + err)
        .then(() => ErrorLog.append('Upgrade._installInitScripts(copying files): ' + err))
        .then(() => {
          throw Error('_installInitScripts|' + err);
        });
      })
      .then(() => this._actionProgress(++this._startingInstallInitScripts, this._totalProgressItems))
      .then(() => Helper.evalAsPromise('chmod', ['644', dst]))
      .then((results) => {
        return Helper.appendIndentedResultsToLog(results, 'chmod 644 ' + dst + 'results:');
      }, (err) => {
        return Helper.appendToLog('Error in chmod: ' + err)
        .then(() => ErrorLog.append('Upgrade._installInitScripts(chmod): ' + err))
        .then(() => {
          throw Error('_installInitScripts|' + err);
        });
      })
      .then(() => this._actionProgress(++this._startingInstallInitScripts, this._totalProgressItems));
    }

    _countProgressItems() {
      // figure out how many total progress items there will be
      this._totalProgressItems = 0;
      return Promise.resolve()
      .then(() => logger.debug('COUNTING PROGRESS ITEMS'))
      .then(() => this._countPrehookScripts())
      .then(() => this._countClearBackupDir())
      .then(() => this._countTargetFilesToMove())
      .then(() => this._countRomgModulesAndData())
      .then(() => this._countCleanupRomgDataDir())
      .then(() => this._countSetYarnCacheFolder())
      .then(() => this._countRunYarnInstallOnBase())
      .then(() => this._countRunYarnInstallOnModules())
      .then(() => this._countUpdatePermissions())
      .then(() => this._countInstallInitScripts())
      .then(() => this._countPosthookScripts())
      .then(() => {
        // if we're debugging, log the number of items in each group
        logger.debug('startingPrehookScripts          ' + ('  ' + this._startingPrehookScripts).slice(-3));
        logger.debug('startingClearBackupDir          ' + ('  ' + this._startingClearBackupDir).slice(-3));
        logger.debug('startingTargetFilesToMove       ' + ('  ' + this._startingTargetFilesToMove).slice(-3));
        logger.debug('startingRomgModulesAndData      ' + ('  ' + this._startingRomgModulesAndData).slice(-3));
        logger.debug('startingCleanupRomgDataDir      ' + ('  ' + this._startingCleanupRomgDataDir).slice(-3));
        logger.debug('startingSetYarnCacheFolder      ' + ('  ' + this._startingSetYarnCacheFolder).slice(-3));
        logger.debug('startingRunYarnInstallOnBase    ' + ('  ' + this._startingRunYarnInstallOnBase).slice(-3));
        logger.debug('startingRunYarnInstallOnModules ' + ('  ' + this._startingRunYarnInstallOnModules).slice(-3));
        logger.debug('startingUpdatePermissions       ' + ('  ' + this._startingUpdatePermissions).slice(-3));
        logger.debug('startingInstallInitScripts      ' + ('  ' + this._startingInstallInitScripts).slice(-3));
        logger.debug('startingPosthookScripts         ' + ('  ' + this._startingPosthookScripts).slice(-3));
        logger.debug('TOTAL PROGRESS COUNT            ' + ('  ' + this._totalProgressItems).slice(-3));
      });
    }

    // //////////////////////////////////////////////////////////////////////////
    // Various action promises
    // //////////////////////////////////////////////////////////////////////////

    // returns a promise whose resolved value is the number of files in the
    // folder (not counting the exclusions)
    _countFiles(fromDir, exclusions) {
      while (path.basename(fromDir) == '*') {
        fromDir = path.dirname(fromDir);
      }
      return Promise.resolve()
      .then(() => this._dirExists(fromDir))
      .then(() => {
        // dir exists... check for files
        return Promise.resolve()
        .then(() => Helper.evalAsPromise('ls', ['-a', fromDir]))
        .then((lsResults) => {
          if (lsResults.output.length > 0) {
            const items = lsResults.output[0].split('\n')
            .filter((entry) => (!exclusions.includes(entry)));
            return Promise.resolve()
            .then(() => logger.debug('_countFiles(' + fromDir + ', ' + exclusions + '): ' + items))
            .then(() => items.length);
          }
          return 0;
        }, (err) => {
          Helper.appendToLog('Error in _countFiles(' + fromDir + '): ' + err);
          throw Error('_countFiles|' + err);
        });
      }, () => {
        // dir does not exist: 0 files
        return 0;
      }, (err) => {
        return Helper.appendToLog('Error in _countFiles(' + fromDir + '): ' + err)
        .then(() => ErrorLog.append('Upgrade._countFiles(' + fromDir + '): ' + err))
        .then(() => {
          throw Error('_countFiles|' + err);
        });
      });
    }

    _cp(src, dest) {
      return new Promise((resolve, reject) => {
        logger.verbose('cp('+src+','+dest+')');
        const rd = fs.createReadStream(src);
        rd.on('error', reject);
        const wr = fs.createWriteStream(dest);
        wr.on('error', reject);
        wr.on('close', resolve);
        rd.pipe(wr);
      })
      .catch((err) => {
        return Helper.appendToLog('Error in cp(' + src + '): ' + err)
        .then(() => ErrorLog.append('Upgrade._cp(' + src + '): ' + err))
        .then(() => {
          throw Error('cp('+ src + ',' + dest + ')|' + err);
        });
      });
    }

    _dirExists(path) {
      return new Promise((resolve, reject) => {
        fs.stat(path, (err, stats) => {
          if (err || !stats.isDirectory()) {
            logger.verbose('dirExists('+path+'): no');
            reject(err);
          } else {
            logger.verbose('dirExists('+path+'): yes');
            resolve(path);
          }
        });
      });
    }

    _fileExists(path) {
      return new Promise((resolve, reject) => {
        fs.stat(path, (err, stats) => {
          if (err || !stats.isFile()) {
            logger.verbose('fileExists('+path+'): no');
            reject(err);
          } else {
            logger.verbose('fileExists('+path+'): yes');
            resolve(path);
          }
        });
      });
    }

    _ln(target, path, type) {
      return new Promise((resolve, reject) => {
        fs.symlink(target, path, type, (err) => {
          if (err) {
            logger.verbose('ln(' + target + ', ' + path + ', ' + type + '): no');
            reject(err);
          } else {
            logger.verbose('ln(' + target + ', ' + path + ', ' + type + '): yes');
            resolve(path);
          }
        });
      })
      .catch((err) => {
        return Helper.appendToLog('Error in ln(' + target + '): ' + err)
        .then(() => ErrorLog.append('Upgrade._ln(' + target + '): ' + err))
        .then(() => {
          throw Error('ln('+target+','+path+','+type+')|' + err);
        });
      });
    }

    _mkdir(path, mode) {
      return Promise.resolve()
      .then(() => this._dirExists(path))
      .then(() => {
        // dir exists... we don't need to create it
      }, () => {
        // dir does not exist: create it
        return new Promise((resolve, reject) => {
          fs.mkdir(path, mode, (err) => {
            if (err && (err.code != 'EEXIST')) {
              logger.verbose('mkdir(' + path + '): no');
              reject(err);
            } else {
              logger.verbose('mkdir(' + path + '): yes');
              resolve(path);
            }
          });
        })
        .catch((err) => {
          return Helper.appendToLog('Error in mkdir(' + path + '): ' + err)
          .then(() => ErrorLog.append('Upgrade.mkdir(' + path + '): ' + err))
          .then(() => {
            throw Error('_mkdir('+path+')|' + err);
          });
        });
      });
    }

    _move(src, dst, isVerbose) {
      return Promise.resolve()
      .then(() => this.__moveHelper(path.join(src, '.*'), dst, isVerbose))
      .then((results) => {
        return Promise.resolve()
        .then(() => this.__moveHelper(path.join(src, '*'), dst, isVerbose))
        .then((results2) => Object.assign(results, results2));
      });
    }

    __moveHelper(src, dst, isVerbose) {
      return Promise.resolve()
      .then(() => Helper.execAsPromise('mv', [(isVerbose ? '-v' : ''), src, dst]))
      .then((results) => {
        return results;
      })
      .catch((err) => {
        return Promise.resolve()
        .then(() => logger.error('_move error:' + Helper.objectToString(err)))
        .then(() => ErrorLog.append('Upgrade._move(' + src + '): ' + err))
        .then(() => {
          throw Error('_move|' + err);
        });
      });
    }

    _readDir(path) {
      return new Promise((resolve, reject) => {
        fs.readdir(path, {encoding: 'utf8'}, (err, files) => {
          if (err) {
            reject(err);
          } else {
            resolve(files);
          }
        });
      })
      .catch(() => {
        return Promise.resolve([]);
      });
    }

    _rm(path) {
      return new Promise((resolve, reject) => {
        fs.unlink(path, (err) => {
          if (err && (err.code != 'ENOENT')) {
            reject(err);
          } else {
            resolve(path);
          }
        });
      })
      .catch((err) => {
        return Helper.appendToLog('Error in rm(' + path + '): ' + err)
        .then(() => ErrorLog.append('Upgrade.rm(' + path + '): ' + err))
        .then(() => {
          throw Error('rm('+path+')|' + err);
        });
      });
    }

    _rmrf(rmPath) {
      // watchdog is the maximum number of iterations allowed (5 is usually
      // sufficient; 30 covers the outliers).
      let watchdog = 30;
      const filesRemaining = (rmPath) => {
        return Promise.resolve()
        .then(() => this._countFiles(rmPath, ['', '.', '..']))
        .then((count) => {
          if (watchdog-- < 0) {
            throw Error('rmrf(' + rmPath + '): watchdog expired');
          }
          return Promise.resolve()
          .then(() => logger.debug('[' + watchdog + '] filesRemaining(' + count + ')'))
          .then(() => Promise.resolve(count > 0));
        }, (err) => {
          throw Error('_rmrf|' + err);
        });
      };
      const deleteFiles = (rmPath) => {
        return Promise.resolve()
        .then(() => logger.debug('[' + watchdog + '] deleteFiles(' + rmPath + ')'))
        .then(() => Helper.execAsPromise('rm', ['-rf', rmPath]))
        .then(() => Promise.resolve(rmPath));
      };
      return Helper.promiseWhile(rmPath, filesRemaining, deleteFiles);
    }
  } // UpgradeScript class

  module.exports = UpgradeScript;
})();
