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

  const chai = require('chai');
  const chaiAsPromised = require('chai-as-promised');
  const express = require('express');
  const request = require('supertest');
  const UserManager = require('./../../user-manager.js');
  const userRouter = require('./../../routers/users.js');
  const Promise = require('promise');
  let bodyParser = require('body-parser');

  const expect = chai.expect;

  const testData = {
    getUsers: [1, 2, 3],
    exampleUser: {
      username: 'thisIsATest',
      other: 'field'
    },
    singleUser: {'123abc456': {a: 'a', b: 'b'}}
  };

  chai.use(chaiAsPromised);

  describe('UserRouter', () => {
    let userManager = null;

    let agent = null;

    beforeEach('Create app and router', () => {
      userManager = new UserManager();

      userManager.getUsers = function() {
        return Promise.resolve(testData.getUsers);
      };

      userManager.addUser = function(user) {
        return Promise.resolve(user);
      };

      userManager.getUserFromID = function(id) {
        return Promise.resolve(testData.singleUser[id]);
      };

      userManager.addUser = function(id) {
        return Promise.resolve(testData.singleUser[id]);
      };

      userManager.removeUser = function(id) {
        return Promise.resolve(id);
      };

      const app = express();
      app.use(bodyParser.urlencoded({
        extended: false
      }));

      app.use(bodyParser.json());
      app.use('/', userRouter(userManager));
      agent = request.agent(app);

      return userManager;
    });

    afterEach('Clean Up', () => {

    });

    describe('GET /', () => {
      it('should return array of users', (done) => {
        // done();
        agent
        .get('/')
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200)
        .end((err, res) => {
          expect(res.body).to.deep.equal(testData.getUsers);
          done();
        });
      });
      it('should return array of users, not just any array', (done) => {
        agent
        .get('/')
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200)
        .end((err, res) => {
          expect(res.body).to.not.deep.equal(testData.getUsers.map((a) => {
            return a + 1;
          }));
          done();
        });
      });
    });

    describe('POST /', () => {
      it('should add a user and return the user', (done) => {
        agent
        .post('/')
        .set('Accept', 'application/json')
        .send(testData.exampleUser)
        .expect('Content-Type', /json/)
        .expect(200)
        .end((err, res) => {
          done();
        });
      });
    });

    describe('GET /user_ID', () => {
      it('should a single user', (done) => {
        agent
        .get('/123abc456')
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200)
        .end((err, res) => {
          expect(res.body).to.deep.equal(testData.singleUser['123abc456']);
          done();
        });
      });
      it('should return array of users, not just any array', (done) => {
        agent
        .get('/123abc4')
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200)
        .end((err, res) => {
          expect(res.body).to.not.deep.equal(testData.singleUser['123abc456']);
          done();
        });
      });
    });
    describe('DELETE /user_ID', () => {
      it('should a single user', (done) => {
        agent
        .delete('/123abc456')
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200)
        .end((err, res) => {
          expect(res.body).to.be.equal('123abc456');
          done();
        });
      });
      it('should return array of users, not just any array', (done) => {
        agent
        .delete('/123abc4')
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200)
        .end((err, res) => {
          expect(res.body).to.not.deep.equal(testData.singleUser['123abc456']);
          done();
        });
      });
    });
  });
})();
