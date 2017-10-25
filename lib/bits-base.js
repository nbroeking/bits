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

  const EventEmitter = require('events');
  const cluster = require('cluster');
  const express = require('express');
  const passport = require('passport');
  const multer = require('multer');

  const MessageCenter = require('./message-center');

  const BaseServer = require('./base-server');
  const BitsId = require('./system/bits-id');

  const LoggingManager = require('./logging/logging-manager');
  const CertificateManager = require('./certificate/cert-manager');
  const KeyManager = require('./key/key-manager');
  const CryptoManager = require('./crypto/crypto-manager');
  const UserManager = require('./users/user-manager');
  const AuthManager = require('./auth/auth-manager');
  const ModuleManager = require('./modules/module-manager');
  const OmgsManager = require('./omgs/omgs-manager');
  const ClientManager = require('./client-manager');
  const PageItemManager = require('./ui/page-item-manager');
  const GalleryItemManager = require('./ui/gallery-item-manager');
  const ActivityManager = require('./activity/activity-manager');
  const ScopesManager = require('./scopes/scopes-manager');
  const SystemManager = require('./system/system-manager');
  const ProxyManager = require('./proxy/proxy-manager');
  const HelperManager = require('./helper/helper-manager');

  /*
   * Utils
   */
  const LevelDB = require('./utils/leveldb');
  const UtilArray = require('./utils/array');
  const UtilChildProcess = require('./helpers/child-process');
  const UtilCrypto = require('./utils/crypto');
  const UtilFs = require('./helpers/fs');
  const UtilNetwork = require('./utils/network');
  const UtilOs = require('./utils/os');
  const UtilStream = require('./utils/stream');
  const UtilPem = require('./utils/util-pem');

  /**
   * Home - managers pertaining to base ui components
   */
  const HomeManager = require('./ui/home-manager');

  if (!global.hasOwnProperty('utils')) {
    global.utils = {};
  }
  global.utils.LevelDB = LevelDB;
  global.utils.UtilArray = UtilArray;
  global.utils.UtilChildProcess = UtilChildProcess;
  global.utils.childProcess = UtilChildProcess;
  global.utils.UtilCrypto = UtilCrypto;
  global.utils.crypto = UtilCrypto;
  global.utils.UtilFs = UtilFs;
  global.utils.fs = UtilFs;
  global.utils.UtilNetwork = UtilNetwork;
  global.utils.UtilOs = UtilOs;
  global.utils.os = UtilOs;
  global.utils.UtilStream = UtilStream;
  global.utils.UtilPem = UtilPem;

  /*
  * Helpers
  *
  */
  const ChildProcess = require('./helpers/child-process');
  const CrudManager = require('./helpers/crud-manager');
  const CrudMessenger = require('./helpers/crud-messenger');
  const CrudApi = require('./helpers/crud-api');
  const Daemon = require('./helpers/daemon');
  const FS = require('./helpers/fs');
  const BaseServerHelper = require('./helpers/base-server');
  const GenericMessenger = require('./helpers/messenger');
  const HelperApi = require('./helper/helper-api');
  const LoggingApi = require('./logging/logging-api');
  const ScopesApi = require('./scopes/scopes-api');
  const ModuleApi = require('./modules/module-api');
  const UserApi = require('./users/user-api');
  const ActivityApi = require('./activity/activity-api');
  const LazyLoad = require('./helpers/lazy-load');
  const CryptoApi = require('./crypto/crypto-api');
  const AuthApi = require('./auth/auth-api');
  const SystemApi = require('./system/system-api');
  const KeyApi = require('./key/key-api');
  const CertApi = require('./certificate/certificate-api');
  const KeyValueApi = require('./helpers/key-value-api');
  const KeyValueMessenger = require('./helpers/key-value-messenger');
  const KeyValueManager = require('./helpers/key-value-manager');
  const KeyValueService = require('./helpers/key-value-service');
  const PersistentKeyValueManager = require('./helpers/persistent-key-value-manager');
  const PersistentKeyValueService = require('./helpers/persistent-key-value-service');
  const PouchDBCrudManager = require('./helpers/pouchdb-crud-manager');

  if (!global.hasOwnProperty('helper')) {
    global.helper = {};
  }

  global.helper.ChildProcess = ChildProcess;
  global.helper.CrudManager = CrudManager;
  global.helper.CrudMessenger = CrudMessenger;
  global.helper.CrudApi = CrudApi;
  global.helper.Daemon = Daemon;
  global.helper.FS = FS;
  global.helper.BaseServer = BaseServerHelper;
  global.helper.Messenger = GenericMessenger;
  global.helper.express = express;
  global.helper.passport = passport;
  global.helper.multer = multer;
  global.helper.BaseHelperApi = HelperApi;
  global.helper.BaseLoggingApi = LoggingApi;
  global.helper.BaseScopesApi = ScopesApi;
  global.helper.BaseModuleApi = ModuleApi;
  global.helper.BaseUserApi = UserApi;
  global.helper.BaseActivityApi = ActivityApi;
  global.helper.LazyLoad = LazyLoad;
  global.helper.CryptoApi = CryptoApi;
  global.helper.AuthApi = AuthApi;
  global.helper.SystemApi = SystemApi;
  global.helper.KeyApi = KeyApi;
  global.helper.CertificateApi = CertApi;
  global.helper.KeyValueApi = KeyValueApi;
  global.helper.KeyValueMessenger = KeyValueMessenger;
  global.helper.KeyValueManager = KeyValueManager;
  global.helper.KeyValueService = KeyValueService;
  global.helper.PersistentKeyValueManager = PersistentKeyValueManager;
  global.helper.PersistentKeyValueService = PersistentKeyValueService;
  global.helper.PouchDBCrudManager = PouchDBCrudManager;

  /*
   * Logging
   */
  const LoggerFactory = require('./logging/logger-factory');

  const logger = LoggerFactory.getLogger();

  if (!global.hasOwnProperty('paths')) {
    global.paths = {};
  }

  // Note whatever you do in the constructor will happen in all child processes
  // as well as in the master
  class Base extends EventEmitter {
    constructor(options) {
      super();

      this._messageCenter = new MessageCenter(cluster, process);

      this.options = options || {};
      this._initialized = false;

      // Setup managers
      this._bitsId = new BitsId();
      this._helperManager = new HelperManager();
      this._keyManager = new KeyManager();
      this._certificateManager = new CertificateManager();
      this._cryptoManager = new CryptoManager(this._keyManager, this._messageCenter);
      this._loggingManager = new LoggingManager(this._cryptoManager);
      this._scopeManager = new ScopesManager(this._messageCenter);
      this._userManager = new UserManager(this._messageCenter, this._scopeManager);
      this._authManager = new AuthManager(this._userManager, this._baseServer);
      this._baseServer = new BaseServer(this._authManager, this._keyManager, this._certificateManager);
      this._clientManager = new ClientManager(this._authManager, this._messageCenter);
      this._activityManager = new ActivityManager(this._userManager);
      this._systemManager = new SystemManager(this._bitsId);

      // Base things managers
      this._pageItemManager = new PageItemManager();
      this._galleryItemManager = new GalleryItemManager();
      this._proxyManager = new ProxyManager(this._baseServer);

      // Home managers
      this._homeManager = new HomeManager();

      // Managers to run the apps
      this._moduleManager = new ModuleManager(this._scopeManager, this._cryptoManager, this._userManager, this._loggingManager);
      this._omgManager = new OmgsManager(this._cryptoManager, this._moduleManager);
    }

    sendError(err) {
      logger.debug('%s: %s', err.errno, err.string);
      this.emit('base error', err);
    }

    initialize() {
      logger.debug('Initializing base', global.paths.data);
      return Promise.resolve()
      .then(() => UtilFs.ensureDirectoryExists(global.paths.data))
      .then(() => this._bitsId.load())
      .then(() => this._helperManager.load(this._messageCenter))
      .then(() => this._keyManager.load(this._messageCenter))
      .then(() => this._certificateManager.load(this._messageCenter))
      .then(() => this._cryptoManager.load(this._messageCenter))
      .then(() => this._loggingManager.load(this._messageCenter, this._baseServer))
      .then(() => this._scopeManager.load(this._messageCenter))
      .then(() => this._userManager.load(this._baseServer))
      .then(() => this._authManager.load(this._baseServer, this._messageCenter))
      .then(() => this._activityManager.load(this._messageCenter))
      .then(() => this._pageItemManager.load(this._messageCenter))
      .then(() => this._galleryItemManager.load(this._messageCenter))
      .then(() => this._proxyManager.load(this._messageCenter))
      .then(() => this._homeManager.load(this._messageCenter))
      .then(() => this._systemManager.load(this._messageCenter))
      .then(() => {
        logger.debug('Starting Web Server');
        return this._baseServer.listen();
      })
      .then((server) => this._clientManager.load(server))
      .then(() => this._omgManager.load(this._baseServer, this._messageCenter))
      .catch((err) => {
        logger.error('Base failed to initialize', err);
        return Promise.reject(err);
      });
    }

    load() {
      return this._moduleManager.load(this._messageCenter, this._baseServer)
      .then(() => this._messageCenter.sendEvent('base#Base initialized', {scopes: null}));
    }

    dispatchModule(mod) {
      return Promise.resolve()
      .then(() => this._helperManager.load(this._messageCenter))
      .then(() => this._moduleManager.dispatchModule(mod, this._messageCenter));
    }
  }

  module.exports = Base;
})();
