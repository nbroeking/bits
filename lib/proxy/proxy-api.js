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

  class ProxyApi {
    static get TAG() {
      return 'base#Proxy';
    }

    static get SCOPES() {
      return null;
    }

    static get REQUEST() {
      return {
        ADD: `${ProxyApi.TAG} add`,
        REMOVE: `${ProxyApi.TAG} remove`,
      };
    }

    constructor(messageCenter) {
      this._messageCenter = messageCenter;
    }

    add({workerId, path, host, isAuthenticated}) {
      return this._messageCenter.sendRequest(ProxyApi.REQUEST.ADD, {scopes: ProxyApi.SCOPES}, {
        workerId: workerId,
        path: path,
        host: host,
        isAuthenticated: isAuthenticated
      });
    }

    remove({id}) {
      return this._messageCenter.sendRequest(ProxyApi.REQUEST.REMOVE, {scopes: ProxyApi.SCOPES}, {id: id});
    }
  }

  module.exports = ProxyApi;
})();
