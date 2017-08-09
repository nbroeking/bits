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
  const UtilFs = require('../helpers/fs');
  const UtilCrypto = require('./crypto');

  const DATA_TMP_DIRECTORY = path.join(global.paths.data, '/tmp');

  class UtilOs {
    constructor() {
      throw new Error('Do not create an instance!');
    }

    static createTemporaryDirectory() {
      return UtilFs.stat(DATA_TMP_DIRECTORY)
      .then(null, (err) => {
        if ('ENOENT' === err.code) {
          return UtilFs.mkdir(DATA_TMP_DIRECTORY);
        } else {
          return Promise.reject(err);
        }
      })
      .then(() => {
        return UtilCrypto.randomBytes(8);
      })
      .then((buf) => {
        const randomFilepath = 'tmp.' + buf.toString('hex');
        const dirpath = path.resolve(DATA_TMP_DIRECTORY, randomFilepath);
        return UtilFs.mkdir(dirpath)
        .then(() => {
          return dirpath;
        });
      });
    }
  }

  module.exports = UtilOs;
})();
