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

  const os = require('os');
  const chai = require('chai');
  const chaiAsPromised = require('chai-as-promised');

  global.paths = global.paths || {};
  global.paths = Object.assign(global.paths, {data: os.tmpdir()});

  const DispatchManager = require('./../lib/modules/module-manager');
  chai.use(chaiAsPromised);

  class MessageCenter {
    addEventListener() {}
    addRequestListener() {}
    sendRequest() {
      return Promise.resolve();
    }
    sendEvent() {
      return Promise.resolve();
    }
    addEventSubscriberListener() {}
    addRequestSubsciberListener() {}

    removeEventListener() {}
    removeRequestListener() {}
    removeRequest() {}
    removeEventSubscriberListener() {}
    removeRequestSubsciberListener() {}
  }

  class BaseServer {
    use() {
      return Promise.resolve();
    }
    removeMiddleware() {
      return Promise.resolve();
    }
  }

  describe('DispatchManager creation', () => {
    it('Create DispatchManager', () => {
      new DispatchManager({});
    });
  });

  describe('DispatchManager', () => {
    let dispatchManager = null;

    beforeEach('Create DispatchManager', () => {
      dispatchManager = new DispatchManager();
    });

    it('should load', () => {
      return dispatchManager.load(new MessageCenter(), new BaseServer());
    });

    it('should unload', () => {
      return dispatchManager.load(new MessageCenter(), new BaseServer())
      .then(() => dispatchManager.unload());
    });
  });
})();
