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

  const AuthApi = require('./auth-api');
  const Messenger = require('../helpers/messenger');

  class AuthMessenger extends Messenger {
    static get SCOPES() {
      return null;
    }

    constructor(manager) {
      super();
      this._manager = manager;

      this.addRequestListener(AuthApi.REQUESTS.GET_ACCESS_TOKEN_FOR_USER, {scopes: AuthMessenger.SCOPES}, this._getAccessTokenForUser.bind(this));
      this.addRequestListener(AuthApi.REQUESTS.REVOKE_ACCESS_TOKEN_FOR_USER, {scopes: AuthMessenger.SCOPES}, this._revokeAccessTokenForUser.bind(this));
      this.addRequestListener(AuthApi.REQUESTS.VALIDATE_ACCESS_TOKEN, {scopes: AuthMessenger.SCOPES}, this._validateAccessToken.bind(this));
    }

    _getAccessTokenForUser(metadata, user) {
      return this._manager.getAccessTokenForUser(user);
    }

    _revokeAccessTokenForUser(metadata, user) {
      return this._manager.revokeAccessTokenForUser(user);
    }

    _validateAccessToken(metadata, {token=null}={}) {
      return this._manager.validateAccessToken(token);
    }
  }

  module.exports = AuthMessenger;
})();
