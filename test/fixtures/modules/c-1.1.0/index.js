(() => {
  'use strict';

  const util = require('util');

  const dbg = util.debuglog('c-1.1.0:Api');

  class Api {
    constructor() {
      throw new Error('do not create instance');
    }

    static load(base) {
      dbg('Loaded');
    }

    static unload(base) {
      dbg('Unloaded');
    }
  }

  module.exports = Api;
})();
