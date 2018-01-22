(() => {
  'use strict';

  const BearerStrategy = require('passport-http-bearer');
  const chai = require('chai');
  const express = require('express');
  const fs = require('fs');
  const MessageCenter = require('./../../lib/message-center');
  const os = require('os');
  const passport = require('passport');
  const path = require('path');
  const request = require('supertest');
  const UserManager = require('./../../lib/users/user-manager');
  const UtilFs = require('./../../lib/helpers/fs');

  const {expect} = chai;

  describe('UsersRouter', () => {
    let dataDir = null;
    let messageCenter = null;
    let baseServer = null;
    let user = null;
    let manager = null;

    beforeEach('Create data directory', (done) => {
      fs.mkdtemp(path.join(os.tmpdir(), 'base-user-rotuer-test-'), (err, folder) => {
        if (err) {
          done(err);
        } else {
          dataDir = folder;
          global.paths.data = dataDir;
          done();
        }
      });
    });

    afterEach('Remove data dir', () => {
      return UtilFs.rmdir(dataDir, {recursive: true});
    });

    beforeEach('Create message center', () => {
      messageCenter = new MessageCenter(require('cluster'), process);
    });

    beforeEach('Create base server', () => {
      baseServer = express();
      baseServer.use(passport.initialize());
      passport.use(new BearerStrategy((token, done) => {
        if (user) {
          done(null, user);
        } else {
          done(new Error('user not found'));
        }
      }));
    });

    beforeEach('Create manager', () => {
      const scopesManager = new class {};
      manager = new UserManager(scopesManager);
      return manager.load(messageCenter, baseServer);
    });

    beforeEach('Create admin user', () => {
      const createRequest = {
        username: 'admin',
        password: 'Password1',
        scopes: [
          {name: 'base'},
          {name: 'account'},
        ],
      };
      return Promise.resolve()
      .then(() => manager.create(createRequest))
      .then((newUser) => {
        user = newUser;
      });
    });

    it('should GET / get the user list', (done) => {
      Promise.resolve()
      .then(() => {
        request(baseServer)
        .get('/api/base/users')
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer 1234')
        .expect('Content-Type', /json/)
        .expect(200)
        .end((err, res) => {
          if (err) {
            return done(err);
          }
          const {success, result} = res.body;
          expect(success).to.be.true;
          expect(result).to.be.lengthOf(1);
          expect(result[0].username).to.equal(user.username);
          done();
        });
      })
      .catch(done);
    });

    it('POST / should create a user', (done) => {
      const createRequest = {username: 'test', password: 'password'};
      Promise.resolve()
      .then(() => {
        request(baseServer)
        .post('/api/base/users')
        .send(createRequest)
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer 1234')
        .expect('Content-Type', /json/)
        .expect(200)
        .end((err, res) => {
          if (err) {
            return done(err);
          }
          const {success, result} = res.body;
          expect(success).to.be.true;
          expect(result.username).to.equal(createRequest.username);
          expect(result.scopes).to.be.lengthOf(1);
          expect(result.isAnonymous).to.be.false;
          done();
        });
      })
      .catch(done);
    });

    it('GET /:userId should get user', (done) => {
      Promise.resolve()
      .then(() => {
        request(baseServer)
        .get(`/api/base/users/${user.id}`)
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer 1234')
        .expect('Content-Type', /json/)
        .expect(200)
        .end((err, res) => {
          if (err) {
            return done(err);
          }
          const {success, result} = res.body;
          expect(success).to.be.true;
          expect(result.username).to.equal(user.username);
          done();
        });
      })
      .catch(done);
    });

    it('POST /:userId should update user', (done) => {
      const updateRequest = {scopes: [{name: 'foo'}]};
      Promise.resolve()
      .then(() => {
        request(baseServer)
        .post(`/api/base/users/${user.id}`)
        .send(updateRequest)
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer 1234')
        .expect('Content-Type', /json/)
        .expect(200)
        .end((err, res) => {
          if (err) {
            return done(err);
          }
          const {success, result} = res.body;
          expect(success).to.be.true;
          expect(result.username).to.equal(user.username);
          expect(result.scopes).to.be.lengthOf(2);
          done();
        });
      })
      .catch(done);
    });

    it('PUT /:userId should update user', (done) => {
      const updateRequest = {scopes: [{name: 'bar'}]};
      Promise.resolve()
      .then(() => {
        request(baseServer)
        .put(`/api/base/users/${user.id}`)
        .send(updateRequest)
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer 1234')
        .expect('Content-Type', /json/)
        .expect(200)
        .end((err, res) => {
          if (err) {
            return done(err);
          }
          const {success, result} = res.body;
          expect(success).to.be.true;
          expect(result.username).to.equal(user.username);
          expect(result.scopes).to.be.lengthOf(2);
          done();
        });
      })
      .catch(done);
    });

    it('DELETE /:userId should delete user', (done) => {
      Promise.resolve()
      .then(() => {
        request(baseServer)
        .delete(`/api/base/users/${user.id}`)
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer 1234')
        .expect('Content-Type', /json/)
        .expect(200)
        .end((err, res) => {
          if (err) {
            return done(err);
          }
          const {success, result} = res.body;
          expect(success).to.be.true;
          expect(result.username).to.equal(user.username);
          done();
        });
      })
      .catch(done);
    });
  });
})();
