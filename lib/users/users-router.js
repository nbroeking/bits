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

  let express = require('express');
  let Router = express.Router;
  const bodyParser = require('body-parser');

  /*
  Routes added by this module
  Route       HTTP Verb    Description
  /           GET          Get all users
  /           POST         Create new user
  /:user_ID   GET          Get single user
  /:user_ID   PUT          Update user
  /:user_ID   DELETE       Delete user
  */

  module.exports = function(um) {
    let router = new Router();

    router.use(bodyParser.urlencoded({extended: false}));
    router.use(bodyParser.json());

    router.route('/') // Get all users
    .get(function(req, res, next) {
      um.getUsers()
      .then(function(users) {
        res.header('Content-Type', 'application/json');
        res.json(users);
        return Promise.resolve(users);
      }, function(err) {
        err = err.errmsg || err;
        res.status(400);
        res.send(err);
        return Promise.reject(err);
      });
    })
    .post(function(req, res, next) { // Create new user
      um.addUser(req.body)
      .then(function(user) {
        res.header('Content-Type', 'application/json');
        res.json(user);
        return Promise.resolve(user);
      }, function(err) {
        res.status(400);
        res.send(err);
        return Promise.reject(err);
      });
    });

    router.route('/:user_ID') // Get user by ID
    .get(function(req, res, next) {
      um.getUserFromID(req.params.user_ID)
      .then(function(users) {
        res.header('Content-Type', 'application/json');
        res.json(users);
        return Promise.resolve(users);
      }, function(err) {
        err = err.errmsg || err;
        res.status(400);
        res.send(err);
        return Promise.reject(err);
      });
    })
    .put(function(req, res, next) { // Update user
      req.body._id = req.params.user_ID;
      um.updateUser(req.body)
      .then(function(user) {
        res.header('Content-Type', 'application/json');
        res.json(user);
        return Promise.resolve(user);
      }, function(err) {
        err = err.errmsg || err;
        res.status(400);
        res.send(err);
        return Promise.reject(err);
      });
    }) // Delete user by ID
    .delete(function(req, res, next) {
      um.removeUser(req.params.user_ID)
      .then(function(user) {
        res.header('Content-Type', 'application/json');
        res.json(user);
        return Promise.resolve(user);
      }, function(err) {
        err = err.errmsg || err;
        res.status(400);
        res.send(err);
        return Promise.reject(err);
      });
    });

    return router;
  };
})();
