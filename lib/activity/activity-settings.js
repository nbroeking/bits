(() => {
  'use strict';

  const KEY_ACTIVITY_LIMIT = 'activityLimit';

  const DEFAULT_ACTIVITY_LIMIT = 1000;

  const path = require('path');
  const UtilFs = require('./../helpers/fs');
  const PersistentKeyValueService = require('../helpers/persistent-key-value-service');

  class ActivitySettings {
    constructor() {
      this._settingsLocation = path.resolve(global.paths.data, 'base/activity-settings');
      this._settingsService = new PersistentKeyValueService({
        tag: 'base#ActivitySettings',
        readScopes: [],
        writeScopes: ['base'],
        location: this._settingsLocation
      });
      this._activityLimit = Number.MAX_VALUE;
    }

    load(messageCenter) {
      return Promise.resolve()
      .then(() => UtilFs.ensureDirectoryExists(this._settingsLocation))
      .then(() => this._settingsService.load(messageCenter))
      .then(() => this._initializeDefaults());
    }

    _initializeDefaults() {
      return Promise.resolve()
      .then(() => this._initializeDefault({key: KEY_ACTIVITY_LIMIT, value: DEFAULT_ACTIVITY_LIMIT}));
    }

    _initializeDefault({key, value}) {
      const manager = this._settingsService.getManager();
      return Promise.resolve()
      .then(() => manager.has({key: key}))
      .then((exists) => {
        if (!exists) {
          return manager.set({key: key, value: value});
        }
        manager.on('delete', (op) => {
          if (key === op.key) {
            manager.set({key: key, value: value});
          }
        });
      });
    }

    getActivityLimit() {
      const manager = this._settingsService.getManager();
      return Promise.resolve()
      .then(() => manager.get({key: KEY_ACTIVITY_LIMIT}))
      .then((activityLimit) => Number(activityLimit));
    }

    on(...params) {
      const manager = this._settingsService.getManager();
      return manager.on(...params);
    }

    removeListener(...params) {
      const manager = this._settingsService.getManager();
      return manager.removeListener(...params);
    }
  }

  module.exports = ActivitySettings;
})();
