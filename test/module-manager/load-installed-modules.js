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

  const expect = require('chai').expect;

  const ModuleManager = require('./../../module-manager');

  describe('_loadInstalledModules', () => {
    let moduleManager = null;

    beforeEach('Create Module Manager', () => {
      moduleManager = new ModuleManager();
    });

    it('should run succeed if no modules', () => {
      return moduleManager._loadInstalledModules();
    });

    it('should succeed if installed module cannot be loaded', () => {
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

      moduleManager._modules.push(modA);

      return moduleManager._loadInstalledModules();
    });

    it('should load an installed module', () => {
      const modA = {
        name: 'A',
        isInstalled: true,
        isLoaded: false,
        isBase: false,
        installedVersion: '1.0.0',
        installedDir: ''
      };

      moduleManager._modules.push(modA);

      return moduleManager._loadInstalledModules()
      .then(() => {
        expect(modA.isLoaded).to.be.true;
      });
    });
  });
})();
