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

  const Messenger = require('./../helpers/messenger');
  const CertificatesApi = require('./certificate-api');

  class CertificatesMessenger extends Messenger {
    constructor(manager) {
      super();
      this._manager = manager;
      this.addRequestListener(CertificatesApi.REQUEST.CREATE, CertificatesApi.SCOPES, this._create.bind(this));
      this.addRequestListener(CertificatesApi.REQUEST.LIST, CertificatesApi.SCOPES, this._list.bind(this));
      this.addRequestListener(CertificatesApi.REQUEST.DELETE, CertificatesApi.SCOPES, this._delete.bind(this));
      this.addRequestListener(CertificatesApi.REQUEST.GET_SERVER_CERT, CertificatesApi.SCOPES, this._getServerCert.bind(this));
      this.addRequestListener(CertificatesApi.REQUEST.GET_CLIENT_CERT, CertificatesApi.SCOPES, this._getClientCert.bind(this));
    }

    _create(metadata, request) {
      return this._manager.create(request);
    }

    _list() {
      return this._manager.list();
    }

    _delete(metadata, request) {
      return this._manager.delete(request);
    }

    _getServerCert(metadata) {
      return this._manager.getDeviceServerCert();
    }

    _getClientCert(metadata) {
      return this._manager.getDeviceClientCert();
    }
  }

  module.exports = CertificatesMessenger;
})();
