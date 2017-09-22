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

  const os = require('os');
  const chai = require('chai');
  const chaiAsPromised = require('chai-as-promised');

  global.paths = global.paths || {};
  global.paths = Object.assign(global.paths, {data: os.tmpdir()});

  const ModuleManager = require('./../lib/modules/module-manager');

  const expect = chai.expect;

  chai.use(chaiAsPromised);

  describe('ModuleManager', () => {
    let moduleManager = null;

    beforeEach('Create ModuleManager', () => {
      moduleManager = new ModuleManager();
    });

    describe('checkModuleInfoRequiredParameters', () => {
      it('should rejected if no module information is given', () => {
        return expect(moduleManager.checkModuleInfoRequiredParameters()).to.be.rejectedWith('Module Info must not be null');
      });

      it('should rejected if there is no name property', () => {
        const moduleInfo = {};
        return expect(moduleManager.checkModuleInfoRequiredParameters(moduleInfo)).to.be.rejectedWith('name must be a non-empty string');
      });

      it('should rejected if name property is not a string', () => {
        const moduleInfo = {
          name: 1337
        };
        return expect(moduleManager.checkModuleInfoRequiredParameters(moduleInfo)).to.be.rejectedWith('name must be a non-empty string');
      });

      it('should rejected if name property is an empty string', () => {
        const moduleInfo = {
          name: ''
        };
        return expect(moduleManager.checkModuleInfoRequiredParameters(moduleInfo)).to.be.rejectedWith('name must be a non-empty string');
      });

      it('should rejected if the version property is not valid', () => {
        const moduleInfo = {
          name: 'a',
          version: 'not a valid version'
        };
        return expect(moduleManager.checkModuleInfoRequiredParameters(moduleInfo)).to.be.rejectedWith('Module must have a valid semver version');
      });

      it('should return the moduleInfo given if a proper moduleInfo', () => {
        const moduleInfo = {
          name: 'a',
          version: '1.0.0'
        };
        return moduleManager.checkModuleInfoRequiredParameters(moduleInfo)
        .then((modInfo) => {
          expect(modInfo).to.equal(moduleInfo);
        });
      });
    });
  });
})();
