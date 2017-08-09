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

  class AuthApi {
    static get TAG() {
      return 'base#Auth';
    }

    static get REQUESTS() {
      return {
        GET_ACCESS_TOKEN_FOR_USER: `${AuthApi.TAG} getAccessTokenForUser`,
        REVOKE_ACCESS_TOKEN_FOR_USER: `${AuthApi.TAG} revokeAccessTokenForUser`,
        VALIDATE_ACCESS_TOKEN: `${AuthApi.TAG} validateAccessToken`
      };
    }

    constructor(messageCenter) {
      this._messageCenter = messageCenter;
    }

    getAccessTokenForUser(user) {
      return this._messageCenter.sendRequest(AuthApi.REQUESTS.GET_ACCESS_TOKEN_FOR_USER, {scopes: null}, user);
    }

    revokeAccessTokenForUser(user) {
      return this._messageCenter.sendRequest(AuthApi.REQUESTS.REVOKE_ACCESS_TOKEN_FOR_USER, {scopes: null}, user);
    }

    validateAccessToken(request) {
      return this._messageCenter.sendRequest(AuthApi.REQUESTS.VALIDATE_ACCESS_TOKEN, {scopes: null}, request);
    }
  }

  module.exports = AuthApi;
})();
