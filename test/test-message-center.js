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

  process.on('unhandledRejection', (reason, p) => {
    console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
    // application specific logging, throwing an error, or other logic here
    p.catch((err) => {
      console.log(err.stack);
    });
  });

  const chai = require('chai');
  const chaiAsPromised = require('chai-as-promised');
  const MessageCenter = require('../lib/message-center');
  const EventEmitter = require('events');

  const expect = chai.expect;

  chai.use(chaiAsPromised);

  function noop() {}

  describe('MessageCenter(master)', () => {
    let messageCenter = null;
    beforeEach(() => {
      const cluster = new EventEmitter();
      cluster.isMaster = true;
      const process = new EventEmitter();
      messageCenter = new MessageCenter(cluster, process);
    });
    describe('sendEvent', () => {
      it('should return a Promise', () => {
        expect(messageCenter.sendEvent('test', {scopes: null})).to.be.instanceof(Promise);
      });
      it('should trigger event listener', (done) => {
        messageCenter.addEventListener('test', {scopes: null}, (metadata, data) => done(data));
        messageCenter.sendEvent('test', {scopes: null});
      });
      it('should trigger event listener with data', (done) => {
        messageCenter.addEventListener('test', {scopes: null}, (data) => {
          expect(data).to.equals(2);
          done();
        });
        messageCenter.sendEvent('test', {scopes: null}, 2);
      });
      it('should not trigger event listener with different name', (done) => {
        messageCenter.addEventListener('not-test', {scopes: null}, () => done(new Error('Should not be called')));
        messageCenter.sendEvent('test', {scopes: null});
        setTimeout(done, 10);
      });
    });
    describe('sendRequest', () => {
      it('should return a Promise', () => {
        messageCenter.addRequestListener('test', {scopes: null}, () => null);
        expect(messageCenter.sendRequest('test', {scopes: null})).to.be.instanceof(Promise);
      });
      it('should trigger request listener', () => {
        messageCenter.addRequestListener('test', {scopes: null}, () => null);
        return messageCenter.sendRequest('test', {scopes: null});
      });
      it('should trigger request listener with data', () => {
        messageCenter.addRequestListener('test2', {scopes: null}, (metadata, data) => {
          expect(data).to.equals(2);
        });
        return messageCenter.sendRequest('test2', {scopes: null}, 2);
      });
      it('should resolve to request listener result', () => {
        messageCenter.addRequestListener('test3', {scopes: null}, () => 2);
        return messageCenter.sendRequest('test3', {scopes: null})
        .then((data) => expect(data).to.equals(2));
      });
      it('should reject with request listener exception', () => {
        messageCenter.addRequestListener('test', {scopes: null}, () => {
          throw new Error('test');
        });
        return expect(messageCenter.sendRequest('test', {scopes: null})).to.be.rejected;
      });
    });
    describe('addEventListener', () => {
      it('should return a Promise', () => {
        expect(messageCenter.addEventListener('test', {scopes: null}, noop)).to.be.instanceof(Promise);
      });
      it('should call when sendEvent is called', (done) => {
        messageCenter.addEventListener('test', {scopes: null}, (data) => done());
        messageCenter.sendEvent('test', {scopes: null});
      });
      it('should call when scopes are null', (done) => {
        messageCenter.addEventListener('test', {scopes: null}, (data) => done());
        messageCenter.sendEvent('test', {scopes: ['a']});
      });
      it('should call when scopes match sendEvent scopes', (done) => {
        messageCenter.addEventListener('test', {scopes: ['a']}, (data) => done());
        messageCenter.sendEvent('test', {scopes: ['a']});
      });
      it('should call when scopes is a super set of sendEvent scopes', (done) => {
        messageCenter.addEventListener('test', {scopes: ['a', 'b']}, (data) => done());
        messageCenter.sendEvent('test', {scopes: ['a']});
      });
      it('should not call when scopes does not contain sendEvent scopes', (done) => {
        const timeout = setTimeout(done, 10);
        messageCenter.addEventListener('test', {scopes: ['a']}, () => {
          clearTimeout(timeout);
          done(new Error('Should not be called.'));
        });
        messageCenter.sendEvent('test', {scopes: ['b']});
      });
      it('should not call when scopes is not null and sendEvent scopes is null', (done) => {
        const timeout = setTimeout(done, 10);
        messageCenter.addEventListener('test', {scopes: ['a']}, () => {
          clearTimeout(timeout);
          done(new Error('Should not be called.'));
        });
        messageCenter.sendEvent('test', {scopes: null});
      });
      it('should call when scopes contains all sendEvent scopes', (done) => {
        messageCenter.addEventListener('test', {scopes: ['a', 'b']}, (data) => done());
        messageCenter.sendEvent('test', {scopes: ['a', 'b']});
      });
      it('should call when scopes contains all sendEvent scopes (extra)', (done) => {
        messageCenter.addEventListener('test', {scopes: ['a', 'b', 'c']}, (data) => done());
        messageCenter.sendEvent('test', {scopes: ['a', 'b']});
      });
      it('should not call when scopes does not contain all sendEvent scopes', (done) => {
        const timeout = setTimeout(done, 10);
        messageCenter.addEventListener('test', {scopes: ['a']}, (data) => {
          clearTimeout(timeout);
          done(new Error('Should not be called.'));
        });
        messageCenter.sendEvent('test', {scopes: ['a', 'b']});
      });
      it('should not call when scopes does not contain all sendEvent scopes (extra)', (done) => {
        const timeout = setTimeout(done, 10);
        messageCenter.addEventListener('test', {scopes: ['a', 'c']}, (data) => {
          clearTimeout(timeout);
          done(new Error('Should not be called.'));
        });
        messageCenter.sendEvent('test', {scopes: ['a', 'b']});
      });
    });
    describe('removeEventListener', () => {
      it('should return a Promise', () => {
        messageCenter.addEventListener('test', {scopes: null}, noop);
        expect(messageCenter.removeEventListener('test', noop)).to.be.instanceof(Promise);
      });
      it('should not call listener on event', (done) => {
        const timeout = setTimeout(done, 10);

        function notCalled() {
          clearTimeout(timeout);
          done(new Error('Should not be called.'));
        }
        messageCenter.addEventListener('test', {scopes: null}, notCalled);
        messageCenter.removeEventListener('test', notCalled);
        messageCenter.sendEvent('test', {scopes: null});
      });
    });
    describe('addRequestListener', () => {
      it('should return a Promise', () => {
        expect(messageCenter.addRequestListener('test', {scopes: null}, noop)).to.be.instanceof(Promise);
      });
      it('should call when sendRequest is called', () => {
        messageCenter.addRequestListener('test', {scopes: null}, () => null);
        return messageCenter.sendRequest('test', {scopes: null});
      });
      it('should call when sendRequest scopes are null', () => {
        messageCenter.addRequestListener('test', {scopes: ['a']}, () => null);
        return messageCenter.sendRequest('test', {scopes: null});
      });
      it('should not call when scopes are null and sendRequest is scoped', (done) => {
        const timeout = setTimeout(done, 10);
        messageCenter.addRequestListener('test', {scopes: null}, () => {
          clearTimeout(timeout);
          done(new Error('Should not be called.'));
        });
        messageCenter.sendRequest('test', {scopes: ['a']})
        .catch(() => null);
      });
      it('should call when scopes match sendRequest scopes', () => {
        messageCenter.addRequestListener('test', {scopes: ['a']}, () => null);
        return messageCenter.sendRequest('test', {scopes: ['a']});
      });
      it('should call when scopes are subset of sendRequest scopes', () => {
        messageCenter.addRequestListener('test', {scopes: ['a']}, () => null);
        return messageCenter.sendRequest('test', {scopes: ['a', 'b']});
      });
      it('should not call when scopes are not a subset of sendRequest scopes', (done) => {
        const timeout = setTimeout(done, 10);
        messageCenter.addRequestListener('test', {scopes: ['a', 'b']}, () => {
          clearTimeout(timeout);
          done(new Error('Should not be called.'));
        });
        messageCenter.sendRequest('test', {scopes: ['a']})
        .catch(() => null);
      });
      it('should not call when scopes are not a subset of sendRequest scopes (extra)', (done) => {
        const timeout = setTimeout(done, 10);
        messageCenter.addRequestListener('test', {scopes: ['a', 'b']}, () => {
          clearTimeout(timeout);
          done(new Error('Should not be called.'));
        });
        messageCenter.sendRequest('test', {scopes: ['a', 'c']})
        .catch(() => null);
      });
    });
    describe('removeRequestListener', () => {
      it('should return a Promise', () => {
        messageCenter.addRequestListener('test', {scopes: null}, noop);
        expect(messageCenter.removeRequestListener('test', noop)).to.be.instanceof(Promise);
      });
      it('should not call listener on request', () => {
        messageCenter.addRequestListener('test', {scopes: null}, noop);
        messageCenter.removeRequestListener('test', noop);
        return expect(messageCenter.sendRequest('test', {scopes: null})).to.be.rejected;
      });
    });

    describe('addEventSubscriberListener', () => {
      it('should get called when an event is added', (done) => {
        messageCenter.addEventSubscriberListener('testA', (metadata) => {
          return done();
        });
        messageCenter.addEventListener('testA', {scopes: null}, () => noop);
      });

      it('should get called when removed removed when an event is added', (done) => {
        messageCenter.addEventSubscriberListener('testA', (metadata) => {
          if (metadata.what === 'removed') {
            return done();
          }
        });
        const func = () => noop;
        messageCenter.addEventListener('testA', {scopes: null}, func);
        messageCenter.removeEventListener('testA', func);
      });

      it('should not get called for other events', (done) => {
        const timeout = setTimeout(done, 10);
        messageCenter.addEventSubscriberListener('testA', (metadata) => {
          clearTimeout(timeout);
          return done('Should not get called');
        });
        const func = () => noop;
        messageCenter.addEventListener('testB', {scopes: null}, func);
      });

      it('should get called with correct scopes when an event is added', (done) => {
        messageCenter.addEventSubscriberListener('testA', (metadata) => {
          let match = true;
          metadata.scopes.forEach((scope) => {
            match = match && scope === 'hi';
          });
          if (match) {
            return done();
          } else {
            return done('missing value');
          }
        });
        messageCenter.addEventListener('testA', ['hi'], () => noop);
      });
    });
  });
})();
