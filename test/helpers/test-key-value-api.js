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

  const TAG = 'tests#KeyValueApi';

  const EventEmitter = require('events');
  const chai = require('chai');
  const chaiAsPromised = require('chai-as-promised');
  const KeyValueApi = require('./../../lib/helpers/key-value-api');
  const MessageCenter = require('./../../lib/message-center');

  const expect = chai.expect;
  chai.use(chaiAsPromised);

  describe('KeyValueApi', () => {
    let messageCenter = null;
    beforeEach('Create message center (master)', () => {
      const cluster = new EventEmitter();
      cluster.isMaster = true;
      const process = new EventEmitter();
      messageCenter = new MessageCenter(cluster, process);
    });

    after('Clean up', () => {
      messageCenter = null;
    });

    describe('load', () => {
      it('should load', () => {
        const api = new KeyValueApi(TAG, messageCenter);
        return api.load();
      });
    });

    describe('unload', () => {
      it('should unload', () => {
        const api = new KeyValueApi(TAG, messageCenter);
        return api.load(messageCenter)
        .then(() => api.unload());
      });
    });

    describe('calls', () => {
      describe('set', () => {
        it('should send set request', (done) => {
          const timeout = setTimeout(() => done(new Error('request not sent')), 5);
          messageCenter.addRequestListener(`${TAG} set`, {scopes: null}, (metadata, {key, value}) => {
            clearTimeout(timeout);
            try {
              expect(key).to.equal('foo');
            } catch (err) {
              return done(err);
            }
            try {
              expect(value).to.equal('bar');
            } catch (err) {
              return done(err);
            }
            return done();
          })
          .then(() => {
            const api = new KeyValueApi(TAG, messageCenter);
            return api.set({key: 'foo', value: 'bar'});
          })
          .catch(() => done(new Error(err.message)));
        });
      });

      describe('get', () => {
        it('should send get request', (done) => {
          const timeout = setTimeout(() => done(new Error('request not sent')), 5);
          messageCenter.addRequestListener(`${TAG} get`, {scopes: null}, (metadata, {key}) => {
            clearTimeout(timeout);
            try {
              expect(key).to.equal('foo');
            } catch (err) {
              return done(err);
            }
            return done();
          })
          .then(() => {
            const api = new KeyValueApi(TAG, messageCenter);
            return api.get({key: 'foo'});
          })
          .catch(() => done(new Error(err.message)));
        });
      });

      describe('has', () => {
        it('should send has request', (done) => {
          const timeout = setTimeout(() => done(new Error('request not sent')), 5);
          messageCenter.addRequestListener(`${TAG} has`, {scopes: null}, (metadata, {key}) => {
            clearTimeout(timeout);
            try {
              expect(key).to.equal('foo');
            } catch (err) {
              return done(err);
            }
            return done();
          })
          .then(() => {
            const api = new KeyValueApi(TAG, messageCenter);
            return api.has({key: 'foo'});
          })
          .catch(() => done(new Error(err.message)));
        });
      });

      describe('delete', () => {
        it('should send delete request', (done) => {
          const timeout = setTimeout(() => done(new Error('request not sent')), 5);
          messageCenter.addRequestListener(`${TAG} delete`, {scopes: null}, (metadata, {key}) => {
            clearTimeout(timeout);
            try {
              expect(key).to.equal('foo');
            } catch (err) {
              return done(err);
            }
            return done();
          })
          .then(() => {
            const api = new KeyValueApi(TAG, messageCenter);
            return api.delete({key: 'foo'});
          })
          .catch(() => done(new Error(err.message)));
        });
      });

      describe('clear', () => {
        it('should send clear request', (done) => {
          const timeout = setTimeout(() => done(new Error('request not sent')), 5);
          messageCenter.addRequestListener(`${TAG} clear`, {scopes: null}, (metadata) => {
            clearTimeout(timeout);
            return done();
          })
          .then(() => {
            const api = new KeyValueApi(TAG, messageCenter);
            return api.clear();
          })
          .catch(() => done(new Error(err.message)));
        });
      });

      describe('keys', () => {
        it('should send keys request', (done) => {
          const timeout = setTimeout(() => done(new Error('request not sent')), 5);
          messageCenter.addRequestListener(`${TAG} keys`, {scopes: null}, (metadata) => {
            clearTimeout(timeout);
            return done();
          })
          .then(() => {
            const api = new KeyValueApi(TAG, messageCenter);
            return api.keys();
          })
          .catch(() => done(new Error(err.message)));
        });
      });

      describe('values', () => {
        it('should send values request', (done) => {
          const timeout = setTimeout(() => done(new Error('request not sent')), 5);
          messageCenter.addRequestListener(`${TAG} values`, {scopes: null}, (metadata) => {
            clearTimeout(timeout);
            return done();
          })
          .then(() => {
            const api = new KeyValueApi(TAG, messageCenter);
            return api.values();
          })
          .catch(() => done(new Error(err.message)));
        });
      });

      describe('addSetListener', () => {
        it('should add listener for set event', (done) => {
          const timeout = setTimeout(() => done(new Error('listener did not receive event')), 5);
          const api = new KeyValueApi(TAG, messageCenter);
          api.addSetListener(({key, value}) => {
            clearTimeout(timeout);
            try {
              expect(key).to.equal('foo');
            } catch (err) {
              return done(err);
            }
            try {
              expect(value).to.equal('bar');
            } catch (err) {
              return done(err);
            }
            return done();
          })
          .then(() => messageCenter.sendEvent(`${TAG} set`, {scopes: null}, {key: 'foo', value: 'bar'}))
          .catch(done);
        });
      });

      describe('removeSetListener', () => {
        it('should remove listener for set event', (done) => {
          const timeout = setTimeout(() => done(), 5);
          const listener = () => {
            clearTimeout(timeout);
            done(new Error('listener was called'));
          };
          const api = new KeyValueApi(TAG, messageCenter);
          api.addSetListener(listener)
          .then(() => api.removeSetListener(listener))
          .then(() => messageCenter.sendEvent(`${TAG} set`, {scopes: null}, {key: 'foo', value: 'bar'}))
          .catch(done);
        });
      });

      describe('addDeleteListener', () => {
        it('should add listener for set event', (done) => {
          const timeout = setTimeout(() => done(new Error('listener did not receive event')), 5);
          const api = new KeyValueApi(TAG, messageCenter);
          api.addDeleteListener(({key}) => {
            clearTimeout(timeout);
            try {
              expect(key).to.equal('foo');
            } catch (err) {
              return done(err);
            }
            return done();
          })
          .then(() => messageCenter.sendEvent(`${TAG} delete`, {scopes: null}, {key: 'foo'}))
          .catch(done);
        });
      });

      describe('removeDeleteListener', () => {
        it('should remove listener for delete event', (done) => {
          const timeout = setTimeout(() => done(), 5);
          const listener = () => {
            clearTimeout(timeout);
            done(new Error('listener was called'));
          };
          const api = new KeyValueApi(TAG, messageCenter);
          api.addDeleteListener(listener)
          .then(() => api.removeDeleteListener(listener))
          .then(() => messageCenter.sendEvent(`${TAG} delete`, {scopes: null}, {key: 'foo'}))
          .catch(done);
        });
      });

      describe('addClearListener', () => {
        it('should add listener for set event', (done) => {
          const timeout = setTimeout(() => done(new Error('listener did not receive event')), 5);
          const api = new KeyValueApi(TAG, messageCenter);
          api.addClearListener(() => {
            clearTimeout(timeout);
            return done();
          })
          .then(() => messageCenter.sendEvent(`${TAG} clear`, {scopes: null}))
          .catch(done);
        });
      });

      describe('removeClearListener', () => {
        it('should remove listener for clear event', (done) => {
          const timeout = setTimeout(() => done(), 5);
          const listener = () => {
            clearTimeout(timeout);
            done(new Error('listener was called'));
          };
          const api = new KeyValueApi(TAG, messageCenter);
          api.addClearListener(listener)
          .then(() => api.removeClearListener(listener))
          .then(() => messageCenter.sendEvent(`${TAG} clear`, {scopes: null}))
          .catch(done);
        });
      });
    });

    describe('events', () => {
      describe('set', () => {
        it('should call listener if loaded', (done) => {
          const timeout = setTimeout(() => done(new Error('listener was not called')), 5);
          const listener = ({key, value}) => {
            clearTimeout(timeout);
            expect(key).to.equal('foo');
            expect(value).to.equal('bar');
            done();
          };
          const api = new KeyValueApi(TAG, messageCenter);
          api.on('set', listener);
          api.load()
          .then(() => messageCenter.sendEvent(`${TAG} set`, {scopes: null}, {key: 'foo', value: 'bar'}))
          .catch(done);
        });
        it('should not call listener if not loaded', (done) => {
          const timeout = setTimeout(() => done(), 5);
          const listener = ({key, value}) => {
            clearTimeout(timeout);
            done(new Error('listener was called'));
          };
          const api = new KeyValueApi(TAG, messageCenter);
          api.on('set', listener);
          messageCenter.sendEvent(`${TAG} set`, {scopes: null}, {key: 'foo', value: 'bar'})
          .catch(done);
        });
      });

      describe('delete', () => {
        it('should call listener if loaded', (done) => {
          const timeout = setTimeout(() => done(new Error('listener was not called')), 5);
          const listener = ({key}) => {
            clearTimeout(timeout);
            expect(key).to.equal('foo');
            return done();
          };
          const api = new KeyValueApi(TAG, messageCenter);
          api.on('delete', listener);
          api.load()
          .then(() => messageCenter.sendEvent(`${TAG} delete`, {scopes: null}, {key: 'foo'}))
          .catch(done);
        });
        it('should not call listener if not loaded', (done) => {
          const timeout = setTimeout(() => done(), 5);
          const listener = ({key}) => {
            clearTimeout(timeout);
            done(new Error('listener was called'));
          };
          const api = new KeyValueApi(TAG, messageCenter);
          api.on('delete', listener);
          messageCenter.sendEvent(`${TAG} delete`, {scopes: null}, {key: 'foo'})
          .catch(done);
        });
      });

      describe('clear', () => {
        it('should call listener if loaded', (done) => {
          const timeout = setTimeout(() => done(new Error('listener was not called')), 5);
          const listener = () => {
            clearTimeout(timeout);
            return done();
          };
          const api = new KeyValueApi(TAG, messageCenter);
          api.on('clear', listener);
          api.load()
          .then(() => messageCenter.sendEvent(`${TAG} clear`, {scopes: null}))
          .catch(done);
        });
        it('should not call listener if not loaded', (done) => {
          const timeout = setTimeout(() => done(), 5);
          const listener = () => {
            clearTimeout(timeout);
            done(new Error('listener was called'));
          };
          const api = new KeyValueApi(TAG, messageCenter);
          api.on('clear', listener);
          messageCenter.sendEvent(`${TAG} clear`, {scopes: null})
          .catch(done);
        });
      });
    });
  });
})();
