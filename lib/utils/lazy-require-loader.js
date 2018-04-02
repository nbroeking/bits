(() => {
  'use strict';

  const path = require('path');

  class LazyRequireLoader {
    add(prop, filepath) {
      if ('string' !== typeof(prop) || 0 >= prop.length) {
        throw new TypeError('prop must be a non-empty string');
      }
      if (!path.isAbsolute(filepath)) {
        throw new TypeError('filepath must be an absolute path');
      }
      Object.defineProperty(this, prop, {
        enumerable: true,
        configurable: true,
        get() {
          return require(filepath);
        }
      });
    }

    remove(prop) {
      if ('string' !== typeof (prop) || 0 >= prop.length) {
        throw new TypeError('prop must be a non-empty string');
      }
      delete this[prop];
    }
  }

  module.exports = LazyRequireLoader;
})();
