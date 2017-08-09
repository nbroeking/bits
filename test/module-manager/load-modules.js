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

  const chai = require('chai');
  const expect = chai.expect;

  const chaiAsPromised = require('chai-as-promised');
  chai.use(chaiAsPromised);

  const ModuleManager = require('./../../module-manager');

  describe('loadModules', () => {
    let moduleManager = null;

    beforeEach('Create Module Manager', () => {
      moduleManager = new ModuleManager();
    });

    it('should reject if cannot load module and not ignoring failures', () => {
      const modA = {
        name: 'A',
        isInstalled: true,
        isLoaded: false,
        isBase: false,
        installedVersion: '1.0.0',
        installedDependencies: {
          'does-not-exist': '1.0.0'
        },
        installedDir: ''
      };

      const modules = [modA];

      return expect(moduleManager.loadModules(modules)).to.be.rejected;
    });

    it('should pass if cannot load module and ignoring failures', () => {
      const modA = {
        name: 'A',
        isInstalled: true,
        isLoaded: false,
        isBase: false,
        installedVersion: '1.0.0',
        installedDependencies: {
          'does-not-exist': '1.0.0'
        },
        installedDir: ''
      };

      const modules = [modA];

      const options = {
        ignoreFailures: true
      };

      return expect(moduleManager.loadModules(modules, options));
    });

    it('should load modules', () => {
      const modA = {
        name: 'A',
        isInstalled: true,
        isLoaded: false,
        isBase: false,
        installedVersion: '1.0.0',
        installedDependencies: {},
        installedDir: ''
      };

      const modB = {
        name: 'B',
        isInstalled: true,
        isLoaded: false,
        isBase: false,
        installedVersion: '1.0.0',
        installedDependencies: {},
        installedDir: ''
      };

      const modules = [modA, modB];

      return moduleManager.loadModules(modules)
      .then(() => {
        expect(modA.isLoaded).to.be.true;
        expect(modB.isLoaded).to.be.true;
      });
    });
  });
})();
