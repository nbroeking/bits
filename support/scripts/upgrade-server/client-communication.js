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

  const logger = require('./simple-logger');
  const Io = require('socket.io');

  // We need this variable because of the static sendReloadCommand method;
  // otherwise we could have it as a class field.
  let socket = null;

  class ClientCommunication {
    constructor() {
      // initialize all fields
      this._currentActivityName = 'Preparing upgrade...';
      this._currentActivityProgressCurrent = 0;
      this._currentActivityProgressTotal = 1000;
      this._currentActivityStatus = null;
      this._prevProgress = 0;
      this._wss = null;
      this._boundOnClose = this._onClose.bind(this);
      this._boundOnConnect = this._onConnection.bind(this);
      this._boundOnDisconnect = this._onDisconnect.bind(this);
      this._boundOnUpdateActivity = this._onUpdateActivity.bind(this);
    }

    load(server) {
      // initialize web socket connection
      this._wss = new Io();
      this._wss.attach(server, {log: true, serveClient: false});
      this._wss.on('connection', this._boundOnConnect);
      this._wss.on('close', this._boundOnClose);
      return Promise.resolve();
    }

    unload() {
      if (this._wss != null) {
        this._wss.close();
        this._wss = null;
      }
      return Promise.resolve();
    }

    _addSocketListeners() {
      socket.on('disconnect', this._boundOnDisconnect);
      socket.on('update-activity', this._boundOnUpdateActivity);
    }

    _onClose() {
      this._wss.removeListener('connection', this._boundOnConnect);
      this._wss.removeListener('close', this._boundOnClose);
    }

    _onConnection(websocket) {
      logger.debug('ClientCommunication.load: CONNECTED');
      socket = websocket;
      this._addSocketListeners();
    }

    _onDisconnect() {
      socket.removeListener('disconnect', this._boundOnDisconnect);
      socket.removeListener('update-activity', this._boundOnUpdateActivity);
      socket = null;
    }

    _onUpdateActivity() {
      this.sendActivityName(this._currentActivityName);
      this.sendActivityProgress(this._currentActivityProgressCurrent, this._currentActivityProgressTotal);
      this.sendActivityStatus(this._currentActivityStatus);
    }

    _emitSocketEvent({event, data}) {
      if (socket != null) {
        socket.emit(event, data);
      } else {
        logger.debug('ClientCommunication._emitSocketEvent(' + event + '): WSS Socket is null');
      }
    }

    sendActivityName(name) {
      // announce action name
      this._currentActivityName = name;
      this._emitSocketEvent({
        event: 'action',
        data: {
          text: name
        }
      });
    }

    sendActivityProgress(current, total) {
      // announce update progress
      this._currentActivityProgressCurrent = current;
      this._currentActivityProgressTotal = total;
      if (current < this._prevProgress) {
        logger.warn('WARNING: new progress < previous progress: ' + current + ' < ' + this._prevProgress);
      }
      this._prevProgress = current;
      this._emitSocketEvent({
        event: 'progress',
        data: {
          completedItems: current,
          totalItems: total
        }
      });
    }

    sendActivityStatus(status) {
      // announce status (for debugging only)
      logger.verbose('Activity status: ' + status);
      this._currentActivityStatus = status;
      // send output only if log level >= debug and we have some status to send
      this._emitSocketEvent({
        event: 'status',
        data: {
          text: status
        }
      });
    }

    sendReloadCommand() {
      this._emitSocketEvent({
        event: 'reload',
        data: {}
      });
    }
  }

  module.exports = ClientCommunication;
})();
