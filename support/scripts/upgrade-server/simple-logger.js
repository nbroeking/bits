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

  const winston = require('winston');

  const logger = new winston.Logger({
    level: 'info', // error=0, warn=1, info=2, verbose=3, debug=4, silly=5
    transports: [
      new winston.transports.Console({
        json: false,
        timestamp: function() {
          const d = new Date();
          return ('0' + d.getHours()).slice(-2)
            + ':'
            + ('0' + d.getMinutes()).slice(-2)
            + ':'
            + ('0' + d.getSeconds()).slice(-2)
            + '.'
            + ('00' + d.getMilliseconds()).slice(-3);
        },
      }),
      new winston.transports.File({
        filename: 'upgrade-server.log',
        json: false
      })
    ],
    exitOnError: false,
  });

  module.exports = logger;
})();
