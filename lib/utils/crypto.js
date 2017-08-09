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

  const PUBLIC_KEY_PREFIX = '-----BEGIN PUBLIC KEY-----';
  const PUBRSA_KEY_PREFIX = '-----BEGIN RSA PUBLIC KEY-----';
  const PRIRSA_KEY_PREFIX = '-----BEGIN RSA PRIVATE KEY-----';

  const crypto = require('crypto');
  const UtilFs = require('../helpers/fs');
  const LoggerFactory = require('./../logging/logger-factory');
  const logger = LoggerFactory.getLogger();

  const TYPE_PUBLIC = Symbol('public');
  const TYPE_PRIVATE = Symbol('private');
  const TYPE_UNKNOWN = Symbol('unknown');

  class UtilCrypto {
    constructor() {
      throw new Error('do not create an instance');
    }

    static randomBytes(size) {
      return new Promise((resolve, reject) => {
        crypto.randomBytes(size, (err, buf) => {
          if (err) {
            reject(err);
          } else {
            resolve(buf);
          }
        });
      });
    }

    static isFilePublicKey(filepath) {
      return UtilCrypto.getTypeFromFile(filepath)
      .then((type) => {
        return UtilCrypto.TYPE_PUBLIC === type;
      });
    }

    static isFilePrivateKey(filepath) {
      return UtilCrypto.getTypeFromFile(filepath)
      .then((type) => {
        return UtilCrypto.TYPE_PRIVATE === type;
      });
    }

    static getTypeFromFile(filepath) {
      return UtilFs.readFile(filepath, 'utf8')
      .then((data) => {
        if (data.startsWith(PRIRSA_KEY_PREFIX)) {
          return UtilCrypto.TYPE_PRIVATE;
        } else if (data.startsWith(PUBLIC_KEY_PREFIX) || data.startsWith(PUBRSA_KEY_PREFIX)) {
          return UtilCrypto.TYPE_PUBLIC;
        } else {
          return UtilCrypto.TYPE_UNKNOWN;
        }
      });
    }

    static calculateHashOfFile(filepath, options) {
      return UtilFs.stat(filepath)
      .then((stat) => {
        return new Promise((resolve, reject) => {
          const start = process.hrtime();

          function calculateDuration(start) {
            const diff = process.hrtime(start);
            return (diff[0] * 1e9 + diff[1]) / 1e6;
          }

          options = options || {};
          const encoding = options.encoding || 'hex';

          let output = null;

          const input = UtilFs.createReadStream(filepath);
          input.on('error', reject);

          let bytesRead = 0;
          input.on('data', (chunk) => {
            bytesRead += chunk.length;
          });
          const interval = setInterval(() => {
            const percent = bytesRead / stat.size;
            const duration = calculateDuration(start);
            const estimatedTotal = duration / percent;
            const estimatedLeft = estimatedTotal - duration;
            logger.debug('calculateHashOfFile: Data: read %d, total: %d (%s%%) - Time: elapsed %sms, total(est) %sms, left(est) %sms',
              bytesRead,
              stat.size,
              (percent * 100).toFixed(2),
              duration.toFixed(2), estimatedTotal.toFixed(2), estimatedLeft.toFixed(2));
          }, 5 * 1000);
          input.on('end', () => clearInterval(interval));

          const hash = crypto.createHash('sha256');
          hash.on('error', reject);
          hash.on('data', (chunk) => {
            if (null === output) {
              output = chunk;
            } else {
              output = Buffer.concat([output, chunk], output.length + chunk.length);
            }
          });
          hash.on('finish', () => {
            if (null !== output) {
              output = output.toString(encoding);
            }

            const duration = calculateDuration(start);
            logger.debug('Calculate hash of file took %sms', duration.toFixed(2), {
              performance: true,
              type: 'duration',
              duration: duration,
              filepath: filepath,
            });

            resolve(output);
          });

          input.pipe(hash);
        });
      });
    }

    static get TYPE_PUBLIC() {
      return TYPE_PUBLIC;
    }

    static get TYPE_PRIVATE() {
      return TYPE_PRIVATE;
    }

    static get TYPE_UNKNOWN() {
      return TYPE_UNKNOWN;
    }
  }

  module.exports = UtilCrypto;
})();
