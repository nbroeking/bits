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

  // Node libs
  const spawn = require('child_process').spawn;
  const EventEmitter = require('events');
  const logger = global.LoggerFactory.getLogger();

  class Daemon extends EventEmitter {
    static createAndStartDaemon(command, parameters, options) {
      const daemon = new Daemon(command, parameters, options);
      return daemon.start()
      .then(() => daemon);
    }

    constructor(command, parameters, {restart = false, spawnOptions={}} = {}) {
      super();
      this._command = command;
      this._parameters = parameters;
      this._options = {restart: restart};
      this._spawnOptions = spawnOptions;
      this._childProcess = null;
      this._boundOnclose = this._onClose.bind(this);
      this._boundOnError = this._onError.bind(this);
      this._boundStdout = this._onStdout.bind(this);
      this._boundStderr = this._onStderr.bind(this);
      this._boundCleanUp = this._cleanUp.bind(this);

      this._shutdownPoison = false;
      this._timeout = null;
      this._restarting = false;
      this._restartCode = null;
    }

    _cleanUp() {
      if (this._childProcess) {
        logger.debug('Daemon cleaning up a child');
        this._childProcess.kill();
      }
    }

    start() {
      if (this._childProcess === null) {
        this._timeoutPoison = false;
        this._childProcess = spawn(this._command, this._parameters, this._spawnOptions);
        if (this._restarting) {
          this.emit('restarted', this._restartCode);
          this._restarting = false;
          this._restartCode = null;
        }
        this._addListeners();
        return Promise.resolve();
      } else {
        return Promise.reject('Already Running Daemon %s', command, parameters);
      }
    }

    write(...data) {
      return Promise.resolve()
      .then(() => {
        return this._childProcess.stdin.write(...data);
      });
    }

    shutdown() {
      clearTimeout(this._timeout);
      if (this._childProcess) {
        this._removeListeners();

        return new Promise((resolve, reject) => {
          let onError = null; // So we can remove both
          let onClose = null;

          onError = (err) => {
            this._childProcess.removeListener('close', onClose);
            this._childProcess.removeListener('error', onError);

            reject(err);
          };
          onClose = (code) => {
            this._childProcess.removeListener('close', onClose);
            this._childProcess.removeListener('error', onError);
            resolve(code);
          };

          this._childProcess.on('error', onError);
          this._childProcess.on('close', onClose);
          this._childProcess.kill();
        })
        .then((result) => {
          this._childProcess = null;
          this.emit('close', result);
        });
      } else {
        if (this._timeout) {
          clearTimeout(this._timeout);
          this._timeout = null;
          this._timeoutPoison = true;
          return Promise.resolve();
        }
        return Promise.reject(new Error('Not running'));
      }
    }

    _addListeners() {
      this._childProcess.on('close', this._boundOnclose);
      this._childProcess.on('error', this._boundOnError);
      this._childProcess.stdout.on('data', this._boundStdout);
      this._childProcess.stderr.on('data', this._boundStderr);

      process.on('SIGINT', this._boundCleanUp);
      process.on('exit', this._boundCleanUp);
    }

    _removeListeners() {
      this._childProcess.removeListener('close', this._boundOnclose);
      this._childProcess.removeListener('error', this._boundOnError);
      this._childProcess.stdout.removeListener('data', this._boundStdout);
      this._childProcess.stderr.removeListener('data', this._boundStderr);

      process.removeListener('exit', this._boundCleanUp);
      process.removeListener('SIGINT', this._boundCleanUp);
    }

    _onClose(code) {
      this._removeListeners();
      this._childProcess.kill();
      this._childProcess = null;

      if (true === this._options.restart) {
        if (!this._timeoutPoison) {
          this._restarting = true;
          this._restartCode = code;
          this._timeout = setTimeout(() => this.start(), 1000);
          this._timeoutPoison = false;
        }
      } else {
        this.emit('close', code);
      }
    }

    _onError(err) {
      this.emit('error', err);
    }

    _onStdout(data) {
      this.emit('stdout', data);
    }

    _onStderr(data) {
      this.emit('stderr', data);
    }

    isRunning() {
      return this._childProcess !== null;
    }

    kill(signal) {
      return this._childProcess.kill(signal);
    }
  }
  module.exports = Daemon;
})();
