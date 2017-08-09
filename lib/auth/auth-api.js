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

  const SCOPES = null;

  const AUTH_PREFIX = 'bits-base#Auth';
  const AUTH = {
    REQUESTS: {
      GET_ACCESS_TOKEN_FOR_USER: AUTH_PREFIX + ' get-access-token-for-user',
      REVOKE_ACCESS_TOKEN_FOR_USER: AUTH_PREFIX + ' revoke-access-token-for-user'
    }
  };

  class AuthApi {
    constructor(messageCenter) {
      this._messageCenter = messageCenter;
    }

    getAccessTokenForUser(user) {
      return this._messageCenter.sendRequest(AUTH.REQUESTS.GET_ACCESS_TOKEN_FOR_USER, {scopes: SCOPES}, user);
    }

    revokeAccessTokenForUser(user) {
      return this._messageCenter.sendRequest(AUTH.REQUESTS.REVOKE_ACCESS_TOKEN_FOR_USER, {scopes: SCOPES}, user);
    }

    static get SCOPES() {
      return SCOPES;
    }

    static get REQUESTS() {
      return AUTH.REQUESTS;
    }
  }

  module.exports = AuthApi;
})();
