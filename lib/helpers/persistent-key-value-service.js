(() => {
  'use strict';

  const KeyValueService = require('./key-value-service');
  const PersistentKeyValueManager = require('./persistent-key-value-manager');

  class PersistentKeyValueService extends KeyValueService {
    createManager(messageCenter, {location}) {
      return new PersistentKeyValueManager({location: location});
    }
  }

  module.exports = PersistentKeyValueService;
})();
