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

  const url = require('url');

  const HistoryApiFallback = function(options) {
    options = options || {};

    return function(req, res, next) {
      let headers = req.headers;

      if (req.method !== 'GET') {
        return next();
      } else if (!headers || typeof headers.accept !== 'string') {
        return next();
      } else if (headers.accept.indexOf('application/json') === 0) {
        return next();
      } else if (!(headers.accept.indexOf('text/html') !== -1 || headers.accept.indexOf('*/*') !== -1)) {
        return next();
      }

      let parsedUrl = url.parse(req.url);
      let match = null;

      options.rewrites = Array.isArray(options.rewrites) ? options.rewrites : [];

      for (let index = 0; index < options.rewrites.length; index++) {
        if ('from' in options.rewrites[index] && 'to' in options.rewrites[index]) {
          match = parsedUrl.pathname.match(options.rewrites[index].from);
          if (match !== null) {
            switch (typeof options.rewrites[index].to) {
            case 'string':
              req.url = options.rewrites[index].to;
              return next();
            case 'function':
              req.url = options.rewrites[index].to({parsedUrl: parsedUrl, match: match});
              return next();
            default:
              break;
            }
          }
        }
      }

      if (parsedUrl.pathname.indexOf('.') !== -1) {
        return next();
      }

      options.index = options.index || 'index.html';
      res.sendFile(options.index);
    };
  };
  module.exports = HistoryApiFallback;
})();
