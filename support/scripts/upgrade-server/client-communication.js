/**
Copyright 2018 LGS Innovations

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

  const Helper = require('./helper');
  const logger = require('./simple-logger');
  const WebSocketServer = require('ws').Server;

  // We need this variable because of the static sendReloadCommand method;
  // otherwise we could have it as a class field.
  let clientCommunicationWebsocket = null;

  class ClientCommunication {
    constructor() {
      // initialize all fields
      this._currentActivityName = 'Preparing upgrade...';
      this._currentActivityProgressCurrent = 0;
      this._currentActivityProgressTotal = 1000;
      this._currentActivityStatus = null;
      this._prevProgress = 0;
      this._wss = null;
    }

    load(server) {
      // initialize web socket connection
      this._wss = new WebSocketServer({server: server});
      this._wss.on('connection', this._doConnection.bind(this));
      return Promise.resolve();
    }

    unload() {
      if (this._wss != null) {
        this._wss.removeEventListener('connection', this._doConnection.bind(this));
        this._wss.close();
        this._wss = null;
      }
      if (clientCommunicationWebsocket != null) {
        clientCommunicationWebsocket.close();
      }
      return Promise.resolve();
    }

    _doConnection(websocket) {
      logger.debug('ClientCommunication.load: CONNECTED');
      clientCommunicationWebsocket = websocket;
      clientCommunicationWebsocket.onmessage = this._processIncomingMessage.bind(this);
      clientCommunicationWebsocket.on('close', this._doClose.bind(this));
    }

    _doClose() {
      clientCommunicationWebsocket = null;
    }

    _processIncomingMessage(event) {
      logger.silly('ClientCommunication.load: WSS Received message: ' + Helper.objectToString(event));
      if ((event.type === 'message') && (event.data === 'updateActivity')) {
        this.sendActivityName(this._currentActivityName);
        this.sendActivityProgress(this._currentActivityProgressCurrent, this._currentActivityProgressTotal);
        this.sendActivityStatus(this._currentActivityStatus);
      }
    }

    sendActivityName(name) {
      // announce action name
      this._currentActivityName = name;
      if (clientCommunicationWebsocket != null) {
        const obj = {
          type: 'action',
          text: name,
        };
        clientCommunicationWebsocket.send(JSON.stringify(obj));
      } else {
        logger.debug('ClientCommunication.sendActivityName(' + name + '): WSS Socket is null');
      }
    }

    sendActivityProgress(current, total) {
      // announce update progress
      this._currentActivityProgressCurrent = current;
      this._currentActivityProgressTotal = total;
      if (current < this._prevProgress) {
        logger.warn('WARNING: new progress < previous progress: ' + current + ' < ' + this._prevProgress);
      }
      this._prevProgress = current;
      if (clientCommunicationWebsocket != null) {
        const obj = {
          type: 'progress',
          completedItems: current,
          totalItems: total,
        };
        clientCommunicationWebsocket.send(JSON.stringify(obj));
      } else {
        logger.debug('ClientCommunication.sendActivityProgress(' + current + '/' + total + '): WSS Socket is null');
      }
    }

    sendActivityStatus(status) {
      // announce status (for debugging only)
      logger.verbose('Activity status: ' + status);
      this._currentActivityStatus = status;
      // send output only if log level >= debug and we have some status to send
      if (clientCommunicationWebsocket != null) {
        const obj = {
          type: 'status',
          text: status,
        };
        clientCommunicationWebsocket.send(JSON.stringify(obj));
      } else {
        logger.debug('ClientCommunication.sendActivityStatus(' + status + '): WSS Socket is null');
      }
    }

    static sendReloadCommand() {
      // Force page reload
      if (clientCommunicationWebsocket != null) {
        const obj = {
          type: 'reload',
        };
        clientCommunicationWebsocket.send(JSON.stringify(obj));
      } else {
        logger.debug('ClientCommunication.sendReloadCommand(): WSS Socket is null');
      }
    }
  }

  module.exports = ClientCommunication;
})();
