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
(function() {
  'use strict';

  const path = require('path');
  const chai = require('chai');
  const chaiAsPromised = require('chai-as-promised');
  const ModuleManager = require('./../../module-manager');

  const expect = chai.expect;

  chai.use(chaiAsPromised);

  describe('_loadModuleIndexJs', () => {
    let moduleManager = null;

    const modA = {
      name: 'A',
      isInstalled: true,
      isLoaded: false,
      isBase: false,
      installedVersion: '1.0.0',
      installedDependencies: {},
      installedDir: undefined
    };

    beforeEach('Create Module Manager', () => {
      moduleManager = new ModuleManager();
    });

    it('should reject if installedDir is not a string', () => {
      modA.installedDir = undefined;
      return expect(moduleManager._loadModuleIndexJs(modA)).to.be.rejected;
    });

    it('should succeed if no index.js exists', () => {
      modA.installedDir = path.join(__dirname, './../fixtures/modules/bad-no-index');
      return moduleManager._loadModuleIndexJs(modA);
    });

    it('should reject if index.js has syntax error', () => {
      modA.installedDir = path.join(__dirname, './../fixtures/modules/bad-syntax-index');
      return expect(moduleManager._loadModuleIndexJs(modA)).to.be.rejected;
    });

    it('should reject if index.js has require error', () => {
      modA.installedDir = path.join(__dirname, './../fixtures/modules/bad-require-index');
      return expect(moduleManager._loadModuleIndexJs(modA)).to.be.rejected;
    });

    it('should succeed if index.js is good', () => {
      modA.installedDir = path.join(__dirname, './../fixtures/modules/good-index');
      return moduleManager._loadModuleIndexJs(modA);
    });
  });
})();
