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

  class CertificatesApi {
    static get TAG() {
      return 'base#Certificates';
    }

    static get SCOPES() {
      return null;
    }

    static get REQUEST() {
      return {
        CREATE: `${CertificatesApi.TAG} create`,
        LIST: `${CertificatesApi.TAG} list`,
        DELETE: `${CertificatesApi.TAG} delete`,
        GET_SERVER_CERT: `${CertificatesApi.TAG} getServerCert`,
        GET_CLIENT_CERT: `${CertificatesApi.TAG} getClientCert`
      };
    }

    constructor(messageCenter) {
      this._messageCenter = messageCenter;
    }

    create(request) {
      return this._messageCenter.sendRequest(CertificatesApi.REQUEST.CREATE, {scopes: CertificatesApi.SCOPES}, request);
    }

    list() {
      return this._messageCenter.sendRequest(CertificatesApi.REQUEST.LIST, {scopes: CertificatesApi.SCOPES});
    }

    delete(request) {
      return this._messageCenter.sendRequest(CertificatesApi.REQUEST.DELETE, {scopes: CertificatesApi.SCOPES}, request);
    }

    getDeviceServerCert() {
      return this._messageCenter.sendRequest(CertificatesApi.REQUEST.GET_SERVER_CERT, CertificatesApi.SCOPES);
    }

    getDeviceClientCert() {
      return this._messageCenter.sendRequest(CertificatesApi.REQUEST.GET_CLIENT_CERT, CertificatesApi.SCOPES);
    }
  }

  module.exports = CertificatesApi;
})();
