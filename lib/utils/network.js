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

  const getNetworkIP = (() => {
    const ignoreRE = /^(127\.0\.0\.1|172\.17\.0\.1|::1|fe80(:1)?::1(%.*)?)$/i;

    const exec = require('child_process').exec;
    let cached;
    let command;
    let filterRE;

    switch (process.platform) {
    // TODO: implement for OSs without ifconfig command
    case 'darwin':
      command = 'ifconfig';
      filterRE = /\binet\s+([^\s]+)/g;
      // filterRE = /\binet6\s+([^\s]+)/g; // IPv6
      break;
    default:
      command = 'ifconfig';
      filterRE = /\binet\b[^:]+:\s*([^\s]+)/g;
      // filterRE = /\binet6[^:]+:\s*([^\s]+)/g; // IPv6
      break;
    }

    return (callback, options) => {
      options = options || {};

      // get cached value
      if (cached && !options.bypassCache) {
        callback(null, cached);
        return;
      }
      // system call
      const cmd = command;
      if (options.args) {
        cmd += ' ' + options.args;
      }
      exec(cmd, (error, stdout, sterr) => {
        const ips = [];
        // extract IPs
        const matches = stdout.match(filterRE);
        // Check for any matches
        if (!matches) {
          callback(new Error('No inet matches found'), null);
          return;
        }
        // JS has no lookbehind REs, so we need a trick
        for (let i = 0; i < matches.length; i++) {
          ips.push(matches[i].replace(filterRE, '$1'));
        }
        // filter BS
        for (let j = 0, l = ips.length; j < l; j++) {
          if (!ignoreRE.test(ips[j])) {
            // if (!error) {
            cached = ips[j];
            // }
            callback(error, ips[j]);
            return;
          }
        }
        // nothing found
        callback(error, null);
      });
    };
  })();

  class UtilNetwork {
    static getNetworkIP(options) {
      return new Promise((fulfill, reject) => {
        getNetworkIP((error, ip) => {
          if (error) {
            reject(error);
          } else {
            fulfill(ip);
          }
        }, options);
      });
    };

    static dot2num(dot) {
      const d = dot.split('.');
      return ((((((Number(d[0])) * 256) + (Number(d[1]))) * 256) + (Number(d[2]))) * 256) + (Number(d[3]));
    }

    static num2dot(num) {
      let d = num % 256;
      for (let i = 3; i > 0; i--) {
        num = Math.floor(num / 256);
        d = num % 256 + '.' + d;
      }
      return d;
    }
  }

  module.exports = UtilNetwork;
})();
