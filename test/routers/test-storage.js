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
  const path = require('path');
  const chai = require('chai');
  const chaiAsPromised = require('chai-as-promised');
  const express = require('express');
  const bodyParser = require('body-parser');
  const request = require('supertest');
  const StorageRouter = require('./../../routers/storage');
  const Storage = require('./../../storage/storage');
  const UtilCrypto = require('./../../utils/crypto');
  const UtilFs = require('./../../helpers/fs');
  const UtilTestRouter = require('./utils');

  const expect = chai.expect;

  chai.use(chaiAsPromised);

  describe('StorageRouter', () => {
    let storage = null;
    let agent = null;

    beforeEach('Create Storage', () => {
      return UtilCrypto.randomBytes(8)
      .then((buffer) => {
        storage = new Storage(path.resolve(os.tmpdir(), 'bits.test.storage' + buffer.toString('hex')));

        const app = express();
        app.use(bodyParser.urlencoded({extended: false}));
        app.use(bodyParser.json());

        const storageRouter = new StorageRouter(storage, {logLevel: 'critical'});
        app.use('/', storageRouter.getRouter());

        agent = request.agent(app);
      });
    });

    afterEach('Delete storage', () => {
      return storage.getBuckets()
      .then((buckets) => buckets.reduce((p, b) => p.then(() => b.delete()), Promise.resolve()))
      .then(() => storage.close())
      .then(() => UtilFs.rmdir(storage.db.location, {recursive: true}));
    });

    describe('bucket', () => {
      describe('list', () => {
        it('should list added buckets.', () => {
          const req = agent.get('/b')
          .expect('Content-Type', /json/)
          .expect(200);

          return storage.createBucket('test')
          .then(() => UtilTestRouter.waitForRequest(req))
          .then((res) => {
            const buckets = res.body;
            expect(buckets).to.have.lengthOf(1);
            expect(buckets[0].name).to.equal('test');
          });
        });
      });

      describe('insert', () => {
        it('should add bucket.', () => {
          const req = agent.post('/b')
          .set('Content-Type', 'application/json')
          .send({name: 'test'})
          .expect('Content-Type', /json/)
          .expect(200);

          return UtilTestRouter.waitForRequest(req)
          .then((res) => {
            const bucket = res.body;
            expect(bucket.name).to.equal('test');
          });
        });

        it('should add bucket metadata.', () => {
          const meta = {foo: 'bar'};

          const req = agent.post('/b')
          .set('Content-Type', 'application/json')
          .send({name: 'test', metadata: meta})
          .expect('Content-Type', /json/)
          .expect(200);

          return UtilTestRouter.waitForRequest(req)
          .then((res) => {
            const bucket = res.body;
            expect(bucket.name).to.equal('test');
            expect(bucket.metadata).to.have.all.keys(meta);
          });
        });

        it('should fail if the bucket name already exists.', () => {
          return storage.createBucket('test')
          .then(() => {
            const req = agent.post('/b')
            .set('Content-Type', 'application/json')
            .send({name: 'test'})
            .expect('Content-Type', /json/)
            .expect(500);

            return UtilTestRouter.waitForRequest(req);
          });
        });

        it('should fail if the bucket name does not meet bucket name requirements.', () => {
          const req = agent.post('/b')
          .set('Content-Type', 'application/json')
          .send({name: '.dot-at-the-beginning-and-end.'})
          .expect('Content-Type', /json/)
          .expect(500);

          return UtilTestRouter.waitForRequest(req);
        });
      });

      describe('get', () => {
        it('should get added bucket.', () => {
          const req = agent.get('/b/test')
          .expect('Content-Type', /json/)
          .expect(200);

          return storage.createBucket('test')
          .then(() => UtilTestRouter.waitForRequest(req))
          .then((res) => {
            const bucket = res.body;
            expect(bucket.name).to.equal('test');
          });
        });

        it('should fail to get added bucket.', () => {
          const req = agent.get('/b/test')
          .expect('Content-Type', /json/)
          .expect(500);

          return UtilTestRouter.waitForRequest(req);
        });
      });

      describe('update', () => {
        it('should fail because it is not implemented [post]', () => {
          const req = agent.post('/b/test')
          .expect('Content-Type', /json/)
          .expect(500);

          return storage.createBucket('test')
          .then(() => UtilTestRouter.waitForRequest(req));
        });

        it('should fail because it is not implemented [put]', () => {
          const req = agent.put('/b/test')
          .expect('Content-Type', /json/)
          .expect(500);

          return storage.createBucket('test')
          .then(() => UtilTestRouter.waitForRequest(req));
        });
      });

      describe('delete', () => {
        it('should delete a bucket', () => {
          const req = agent.delete('/b/test')
          .expect('Content-Type', /json/)
          .expect(200);

          return storage.createBucket('test')
          .then(() => UtilTestRouter.waitForRequest(req))
          .then(() => storage.bucket('test').exists())
          .then((exists) => expect(exists).to.be.false);
        });
      });
    });

    describe('file', () => {
      beforeEach(() => {
        return storage.createBucket('test');
      });

      describe('list', () => {
        it('should return a list of bucket files', () => {
          const req = agent.get('/b/test/o')
          .expect('Content-Type', /json/)
          .expect(200);

          return storage.bucket('test').file('a.txt').save('Notes for a test.')
          .then(() => UtilTestRouter.waitForRequest(req))
          .then((res) => {
            const files = res.body;
            expect(files).to.have.lengthOf(1);
            expect(files[0].name).to.equal('a.txt');
          });
        });
      });

      describe('insert', () => {
        it('should add file', () => {
          const req = agent.post('/b/test/o')
          .field('name', 'a.txt')
          .attach('media', path.resolve(__dirname, './../fixtures/keys/test.pem'))
          .expect('Content-Type', /json/)
          .expect(200);

          return UtilTestRouter.waitForRequest(req)
          .then((res) => {
            const file = res.body;
            expect(file.name).to.equal('a.txt');
          });
        });

        it('should add file metadata', () => {
          const meta = {foo: 'bar'};

          const req = agent.post('/b/test/o')
          .set('Content-Type', 'application/json')
          .field('name', 'a.txt')
          .field('metadata[foo]', 'bar')
          .attach('media', path.resolve(__dirname, './../fixtures/keys/test.pem'))
          .expect('Content-Type', /json/)
          .expect(200);

          return UtilTestRouter.waitForRequest(req)
          .then((res) => {
            const file = res.body;
            expect(file.metadata).to.have.all.keys(meta);
          });
        });

        it('should add file with original name', () => {
          const req = agent.post('/b/test/o')
          .attach('media', path.resolve(__dirname, './../fixtures/keys/test.pem'))
          .expect('Content-Type', /json/)
          .expect(200);

          return UtilTestRouter.waitForRequest(req)
          .then((res) => {
            const file = res.body;
            expect(file.name).to.equal('test.pem');
          });
        });

        it('should add file and honor destination name', () => {
          const req = agent.post('/b/test/o')
          .field('destination', 'meow.txt')
          .attach('media', path.resolve(__dirname, './../fixtures/keys/test.pem'))
          .expect('Content-Type', /json/)
          .expect(200);

          return UtilTestRouter.waitForRequest(req)
          .then((res) => {
            const file = res.body;
            expect(file.name).to.equal('meow.txt');
          });
        });

        it('should add file and honor destination name', () => {
          const req = agent.post('/b/test/o')
          .field('name', 'a.txt')
          .expect('Content-Type', /json/)
          .expect(500);

          return UtilTestRouter.waitForRequest(req);
        });
      });

      describe('get', () => {
        it('should get file data', () => {
          const meta = {foo: 'bar'};

          const req = agent.get('/b/test/o/a.txt')
          .expect('Content-Type', /json/)
          .expect(200);

          return storage.bucket('test').file('a.txt').save('Content', {metadata: meta})
          .then(() => UtilTestRouter.waitForRequest(req))
          .then((res) => {
            const file = res.body;
            expect(file.name).to.equal('a.txt');
            expect(file.metadata).to.have.all.keys(meta);
          });
        });

        it('should return an Error if the file does not exist', () => {
          const req = agent.get('/b/test/o/does-not-exist.txt')
          .expect('Content-Type', /json/)
          .expect(500);

          return UtilTestRouter.waitForRequest(req);
        });

        it('should download file if query parameter alt=media', () => {
          const req = agent.get('/b/test/o/notes.txt?alt=media')
          .expect(200);

          return storage.bucket('test').file('notes.txt').save('some notes!')
          .then(() => UtilTestRouter.waitForRequest(req))
          .then((res) => {
            expect(res.text).to.equal('some notes!');
          });
        });
      });

      describe('update', () => {
        it('should fail because it is not implemented [post]', () => {
          const req = agent.post('/b/test/o/a.txt')
          .expect('Content-Type', /json/)
          .expect(500);

          return storage.bucket('test').file('a.txt').save('update')
          .then(() => UtilTestRouter.waitForRequest(req));
        });

        it('should fail because it is not implemented [put]', () => {
          const req = agent.put('/b/test/o/a.txt')
          .expect('Content-Type', /json/)
          .expect(500);

          return storage.bucket('test').file('a.txt').save('update')
          .then(() => UtilTestRouter.waitForRequest(req));
        });
      });

      describe('delete', () => {
        it('should delete a file', () => {
          const req = agent.delete('/b/test/o/a.txt')
          .expect('Content-Type', /json/)
          .expect(200);

          return storage.bucket('test').file('a.txt').save('for delete')
          .then(() => UtilTestRouter.waitForRequest(req))
          .then(() => storage.bucket('test').file('a.txt').exists())
          .then((exists) => expect(exists).to.be.false);
        });
      });

      describe('copy', () => {
        it('should copy a file to the same bucket', () => {
          const req = agent.post('/b/test/o/a.txt/copyTo/b/test/o/b.txt')
          .expect('Content-Type', /json/)
          .expect(200);

          return storage.bucket('test').file('a.txt').save('for copy')
          .then(() => UtilTestRouter.waitForRequest(req))
          .then(() => storage.bucket('test').file('b.txt').exists())
          .then((exists) => expect(exists).to.be.true);
        });

        it('should copy a file to a different bucket', () => {
          const req = agent.post('/b/test/o/a.txt/copyTo/b/other/o/b.txt')
          .expect('Content-Type', /json/)
          .expect(200);

          return storage.createBucket('other')
          .then(() => storage.bucket('test').file('a.txt').save('for copy'))
          .then(() => UtilTestRouter.waitForRequest(req))
          .then(() => storage.bucket('other').file('b.txt').exists())
          .then((exists) => expect(exists).to.be.true);
        });

        it('should fail if the file does not exist', () => {
          const req = agent.post('/b/test/o/does-not-exist.txt/copyTo/b/other/o/b.txt')
          .expect('Content-Type', /json/)
          .expect(500);

          return storage.createBucket('other')
          .then(() => UtilTestRouter.waitForRequest(req));
        });
      });
    });
  });
})();
