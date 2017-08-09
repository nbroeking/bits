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

  const path = require('path');
  const chai = require('chai');
  const chaiAsPromised = require('chai-as-promised');
  const express = require('express');
  const bodyParser = require('body-parser');
  const request = require('supertest');
  const KeyManager = require('./../../key-manager');
  const CryptoManager = require('./../../crypto-manager');
  const ModuleManager = require('./../../module-manager');
  const createModulesRouter = require('./../../routers/modules');

  const expect = chai.expect;

  chai.use(chaiAsPromised);

  describe('ModulesRouter', () => {
    let keyManager = null;
    let cryptoManager = null;
    let moduleManager = null;
    let agent = null;

    const base = {
      getKeyManager() {
        return keyManager;
      },

      sendError() {}
    };

    beforeEach('Setup managers and create agent', () => {
      keyManager = new KeyManager();

      const bitsSignatureKeyFilepath = path.resolve(__dirname, './../fixtures/keys/bits-signature.pub');
      const testPrivateKeyFilepath = path.resolve(__dirname, './../fixtures/keys/test.pem');

      return keyManager.addKeyFromFilepath(bitsSignatureKeyFilepath)
      .then(() => {
        return keyManager.addKeyFromFilepath(testPrivateKeyFilepath);
      })
      .then(() => {
        cryptoManager = new CryptoManager(keyManager);

        return cryptoManager.load(base);
      })
      .then(() => {
        moduleManager = new ModuleManager();
        moduleManager._cryptoManager = cryptoManager;


        const app = express();

        app.use(bodyParser.urlencoded({extended: false}));

        app.use(bodyParser.json());

        const modulesRouter = createModulesRouter(base, moduleManager);

        app.use('/', modulesRouter);

        agent = request.agent(app);
      });
    });

    afterEach('Clean Up', () => {
      return moduleManager.getModuleList()
      .then((modules) => {
        const moduleNames = modules.map((mod) => mod.name);
        return moduleManager.uninstallModulesByName(moduleNames)
        .then(() => {
          return Promise.all(modules.map((mod) => {
            const packageVersions = Object.keys(mod.packageVersions);
            return Promise.all(packageVersions.map((version) => {
              return moduleManager.remove(mod.name, version);
            }));
          }));
        });
      });
    });

    describe('GET /', () => {
      it('should get array of modules', (done) => {
        agent
        .get('/')
        .expect(200, done);
      });
    });

    describe('POST /', () => {
      it('should successfully upload a module package', (done) => {
        const filepath = path.join(__dirname, './../fixtures/modules-packages/a-1.0.0.bits-signed.mod');

        agent
        .post('/')
        .attach('module-package', filepath)
        .expect(200)
        .end((err, res) => {
          if (err) {
            done(err);
          } else {
            expect(res.body['a-1.0.0.bits-signed.mod']).to.be.true;
            done();
          }
        });
      });

      it('should not upload a module package that is not signed by the bits signature key', (done) => {
        const filepath = path.join(__dirname, './../fixtures/modules-packages/a-1.0.0.test-signed.mod');

        agent
        .post('/')
        .attach('module-package', filepath)
        .expect(400)
        .end((err, res) => {
          if (err) {
            done(err);
          } else {
            expect(res.body['a-1.0.0.test-signed.mod']).to.be.false;
            done();
          }
        });
      });
    });

    describe('POST /<name>', () => {
      it('should successfully load a module package', (done) => {
        const filepath = path.join(__dirname, './../fixtures/modules-packages/a-1.0.0.bits-signed.mod');

        agent
        .post('/')
        .attach('module-package', filepath)
        .expect(200)
        .end((err, res) => {
          if (err) {
            return done(err);
          } else {
            expect(res.body['a-1.0.0.bits-signed.mod']).to.be.true;
          }

          agent
          .post('/a')
          .send({version: '1.0.0'})
          .expect(200)
          .end((err, res) => {
            if (err) {
              return done(err);
            } else {
              expect(res.body.success).to.be.true;
              done();
            }
          });
        });
      });
    });
  });
})();
