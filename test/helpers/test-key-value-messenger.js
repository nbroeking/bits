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

  const TAG = 'tests#KeyValueMessenger';

  const EventEmitter = require('events');
  const chai = require('chai');
  const chaiAsPromised = require('chai-as-promised');
  const KeyValueManager = require('./../../lib/helpers/key-value-manager');
  const KeyValueMessenger = require('./../../lib/helpers/key-value-messenger');
  const KeyValueApi = require('./../../lib/helpers/key-value-api');
  const MessageCenter = require('./../../lib/message-center');

  const expect = chai.expect;
  chai.use(chaiAsPromised);

  describe('KeyValueMessenger', () => {
    let messageCenter = null;
    beforeEach('Create message center (master)', () => {
      const cluster = new EventEmitter();
      cluster.isMaster = true;
      const process = new EventEmitter();
      messageCenter = new MessageCenter(cluster, process);
    });

    let manager = null;
    beforeEach('Create manager', () => {
      manager = new KeyValueManager();
    });

    let api = null;
    beforeEach('Create api', () => {
      api = new KeyValueApi(TAG, messageCenter);
    });

    after('Clean up', () => {
      messageCenter = null;
      manager = null;
      api = null;
    });

    describe('load', () => {
      it('should load', () => {
        const messenger = new KeyValueMessenger(TAG, manager);
        return messenger.load(messageCenter);
      });
    });

    describe('unload', () => {
      it('should unload', () => {
        const messenger = new KeyValueMessenger(TAG, manager);
        return messenger.load(messageCenter)
        .then(() => messenger.unload());
      });
    });

    describe('request', () => {
      describe('set', () => {
        it('should allow request with write scopes', () => {
          const messenger = new KeyValueMessenger(TAG, manager, {writeScopes: ['test.write']});
          return messenger.load(messageCenter)
          .then(() => messageCenter.sendRequest(`${TAG} set`, {scopes: ['test.write']}, {key: 'foo', value: 'bar'}));
        });
        it('should reject request without write scopes', () => {
          const messenger = new KeyValueMessenger(TAG, manager, {writeScopes: ['test.write']});
          const chain = messenger.load(messageCenter)
          .then(() => messageCenter.sendRequest(`${TAG} set`, {scopes: ['test.read']}, {key: 'foo', value: 'bar'}));
          return expect(chain).to.be.rejected;
        });
      });

      describe('get', () => {
        it('should allow request with read scopes', () => {
          const messenger = new KeyValueMessenger(TAG, manager, {readScopes: ['test.read']});
          return messenger.load(messageCenter)
          .then(() => api.set({key: 'foo', value: 'bar'}))
          .then(() => messageCenter.sendRequest(`${TAG} get`, {scopes: ['test.read']}, {key: 'foo'}));
        });
        it('should reject request without read scopes', () => {
          const messenger = new KeyValueMessenger(TAG, manager, {readScopes: ['test.read']});
          const chain = messenger.load(messageCenter)
          .then(() => api.set({key: 'foo', value: 'bar'}))
          .then(() => messageCenter.sendRequest(`${TAG} get`, {scopes: ['test.write']}, {key: 'foo'}));
          return expect(chain).to.be.rejected;
        });
      });

      describe('has', () => {
        it('should allow request with read scopes', () => {
          const messenger = new KeyValueMessenger(TAG, manager, {readScopes: ['test.read']});
          return messenger.load(messageCenter)
          .then(() => api.set({key: 'foo', value: 'bar'}))
          .then(() => messageCenter.sendRequest(`${TAG} has`, {scopes: ['test.read']}, {key: 'foo'}));
        });
        it('should reject request without read scopes', () => {
          const messenger = new KeyValueMessenger(TAG, manager, {readScopes: ['test.read']});
          const chain = messenger.load(messageCenter)
          .then(() => api.set({key: 'foo', value: 'bar'}))
          .then(() => messageCenter.sendRequest(`${TAG} has`, {scopes: ['test.write']}, {key: 'foo'}));
          return expect(chain).to.be.rejected;
        });
      });

      describe('delete', () => {
        it('should allow request with write scopes', () => {
          const messenger = new KeyValueMessenger(TAG, manager, {writeScopes: ['test.write']});
          return messenger.load(messageCenter)
          .then(() => api.set({key: 'foo', value: 'bar'}))
          .then(() => messageCenter.sendRequest(`${TAG} delete`, {scopes: ['test.write']}, {key: 'foo'}));
        });
        it('should reject request without write scopes', () => {
          const messenger = new KeyValueMessenger(TAG, manager, {writeScopes: ['test.write']});
          const chain = messenger.load(messageCenter)
          .then(() => messageCenter.sendRequest(`${TAG} delete`, {scopes: ['test.read']}, {key: 'foo'}));
          return expect(chain).to.be.rejected;
        });
      });

      describe('clear', () => {
        it('should allow request with write scopes', () => {
          const messenger = new KeyValueMessenger(TAG, manager, {writeScopes: ['test.write']});
          return messenger.load(messageCenter)
          .then(() => messageCenter.sendRequest(`${TAG} clear`, {scopes: ['test.write']}));
        });
        it('should reject request without write scopes', () => {
          const messenger = new KeyValueMessenger(TAG, manager, {writeScopes: ['test.write']});
          const chain = messenger.load(messageCenter)
          .then(() => messageCenter.sendRequest(`${TAG} clear`, {scopes: ['test.read']}));
          return expect(chain).to.be.rejected;
        });
      });

      describe('keys', () => {
        it('should allow request with read scopes', () => {
          const messenger = new KeyValueMessenger(TAG, manager, {readScopes: ['test.read']});
          return messenger.load(messageCenter)
          .then(() => messageCenter.sendRequest(`${TAG} keys`, {scopes: ['test.read']}));
        });
        it('should reject request without read scopes', () => {
          const messenger = new KeyValueMessenger(TAG, manager, {readScopes: ['test.read']});
          const chain = messenger.load(messageCenter)
          .then(() => messageCenter.sendRequest(`${TAG} keys`, {scopes: ['test.write']}));
          return expect(chain).to.be.rejected;
        });
      });

      describe('values', () => {
        it('should allow request with read scopes', () => {
          const messenger = new KeyValueMessenger(TAG, manager, {readScopes: ['test.read']});
          return messenger.load(messageCenter)
          .then(() => messageCenter.sendRequest(`${TAG} values`, {scopes: ['test.read']}));
        });
        it('should reject request without read scopes', () => {
          const messenger = new KeyValueMessenger(TAG, manager, {readScopes: ['test.read']});
          const chain = messenger.load(messageCenter)
          .then(() => messageCenter.sendRequest(`${TAG} values`, {scopes: ['test.write']}));
          return expect(chain).to.be.rejected;
        });
      });
    });

    describe('event', () => {
      describe('set', () => {
        it('should call listener with read scopes', (done) => {
          const timeout = setTimeout(() => done(new Error('listener not called')), 5);
          messageCenter.addEventListener(`${TAG} set`, {scopes: ['test.read']}, ({key, value}) => {
            clearTimeout(timeout);
            expect(key).to.equal('foo');
            expect(value).to.equal('bar');
            done();
          });
          const messenger = new KeyValueMessenger(TAG, manager, {readScopes: ['test.read']});
          messenger.load(messageCenter)
          .then(() => manager.set({key: 'foo', value: 'bar'}))
          .catch(done);
        });
        it('should not call listener without read scopes', (done) => {
          const timeout = setTimeout(() => done(), 5);
          messageCenter.addEventListener(`${TAG} set`, {scopes: ['test.write']}, ({key, value}) => {
            clearTimeout(timeout);
            done(new Error('listener was called'));
          });
          const messenger = new KeyValueMessenger(TAG, manager, {readScopes: ['test.read']});
          messenger.load(messageCenter)
          .then(() => manager.set({key: 'foo', value: 'bar'}))
          .catch(done);
        });
      });

      describe('delete', () => {
        it('should call listener with read scopes', (done) => {
          const timeout = setTimeout(() => done(new Error('listener not called')), 5);
          messageCenter.addEventListener(`${TAG} delete`, {scopes: ['test.read']}, ({key}) => {
            clearTimeout(timeout);
            expect(key).to.equal('foo');
            done();
          });
          const messenger = new KeyValueMessenger(TAG, manager, {readScopes: ['test.read']});
          messenger.load(messageCenter)
          .then(() => manager.set({key: 'foo', value: 'bar'}))
          .then(() => manager.delete({key: 'foo'}))
          .catch(done);
        });
        it('should not call listener without read scopes', (done) => {
          const timeout = setTimeout(() => done(), 5);
          messageCenter.addEventListener(`${TAG} delete`, {scopes: ['test.write']}, ({key}) => {
            clearTimeout(timeout);
            done(new Error('listener was called'));
          });
          const messenger = new KeyValueMessenger(TAG, manager, {readScopes: ['test.read']});
          messenger.load(messageCenter)
          .then(() => manager.set({key: 'foo', value: 'bar'}))
          .then(() => manager.delete({key: 'foo'}))
          .catch(done);
        });
      });

      describe('clear', () => {
        it('should call listener with read scopes', (done) => {
          const timeout = setTimeout(() => done(new Error('listener not called')), 5);
          messageCenter.addEventListener(`${TAG} clear`, {scopes: ['test.read']}, () => {
            clearTimeout(timeout);
            done();
          });
          const messenger = new KeyValueMessenger(TAG, manager, {readScopes: ['test.read']});
          messenger.load(messageCenter)
          .then(() => manager.clear({key: 'foo'}))
          .catch(done);
        });
        it('should not call listener without read scopes', (done) => {
          const timeout = setTimeout(() => done(), 5);
          messageCenter.addEventListener(`${TAG} clear`, {scopes: ['test.write']}, () => {
            clearTimeout(timeout);
            done(new Error('listener was called'));
          });
          const messenger = new KeyValueMessenger(TAG, manager, {readScopes: ['test.read']});
          messenger.load(messageCenter)
          .then(() => manager.clear({key: 'foo'}))
          .catch(done);
        });
      });
    });
  });
})();
