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

  const childProcess = require('child_process');

  const spawn = childProcess.spawn;
  const exec = childProcess.exec;

  class UtilChildProcess {
    constructor() {
      throw new Error('do not create instance of UtilChildProcess');
    }

    static createSpawnPromise(command, args, options) {
      return this.spawn(command, args, options);
    }

    static createExecPromise(command, options) {
      return this.exec(command, options);
    }

    static spawn(command, args, options) {
      options = options || {};

      const encoding = options.encoding || 'utf8';

      return new Promise((resolve, reject) => {
        const results = {
          stdout: [],
          stderr: [],
          code: null,
          signal: null,
        };
        const proc = spawn(command, args, options);

        proc.on('error', (err) => reject(err));
        proc.stdout.setEncoding(encoding);
        proc.stdout.on('data', (data) => results.stdout.push(data));
        proc.stderr.setEncoding(encoding);
        proc.stderr.on('data', (data) => results.stderr.push(data));

        proc.on('close', (code, signal) => {
          results.code = code;
          results.signal = signal;
          resolve(results);
        });
      });
    }

    static exec(command, options) {
      options = options || {};

      return new Promise((resolve, reject) => {
        const proc = exec(command, options,
          (error, stdout, stderr) => {
            if (error instanceof Error) {
              reject(error);
            }
            resolve({
              stdout: stdout,
              stderr: stderr,
              code: 0
            });
          });

        if (options.stdout) {
          proc.stdout.pipe(proc.stdout);
        }
        if (options.stderr) {
          proc.stderr.pipe(proc.stderr);
        }
      });
    }
  }

  module.exports = UtilChildProcess;
})();
