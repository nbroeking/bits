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

  const chai = require('chai');
  const chaiAsPromised = require('chai-as-promised');
  const KeyValueManager = require('./../../lib/helpers/key-value-manager');

  const expect = chai.expect;

  chai.use(chaiAsPromised);

  describe('KeyValueManager', () => {
    let keyValueManager = null;

    beforeEach(() => {
      keyValueManager = new KeyValueManager();
    });

    describe('set', () => {
      it('should set a value', () => {
        return keyValueManager.set({key: 'foo', value: 'bar'});
      });
      it('should emit the "set" event', (done) => {
        const timeout = setTimeout(() => done(new Error('listener was not called')), 5);
        const listener = ({key, value}) => {
          clearTimeout(timeout);
          expect(key).to.equal('foo');
          expect(value).to.equal('bar');
          done();
        };
        keyValueManager.once('set', listener);
        keyValueManager.set({key: 'foo', value: 'bar'})
        .catch(done);
      });
    });

    describe('get', () => {
      it('should get a value', () => {
        return keyValueManager.set({key: 'foo', value: 'bar'})
        .then(() => keyValueManager.get({key: 'foo'}))
        .then((value) => expect(value).to.equals('bar'));
      });
      it('should reject if key does not exist', () => {
        return expect(keyValueManager.get({key: 'does-not-exist'})).to.be.rejected;
      });
    });

    describe('has', () => {
      it('should resolve to true if key exists', () => {
        return keyValueManager.set({key: 'foo', value: 'bar'})
        .then(() => keyValueManager.has({key: 'foo'}))
        .then((exists) => expect(exists).to.be.true);
      });
      it('should resolve to false if key does not exist', () => {
        return keyValueManager.has({key: 'foo'})
        .then((exists) => expect(exists).to.be.false);
      });
    });

    describe('delete', () => {
      it('should remove key', () => {
        return keyValueManager.set({key: 'foo', value: 'bar'})
        .then(() => keyValueManager.delete({key: 'foo'}))
        .then(() => keyValueManager.has({key: 'foo'}))
        .then((exists) => expect(exists).to.be.false);
      });
      it('should reject if key does not exist', () => {
        return expect(keyValueManager.delete({key: 'does-not-exist'})).to.be.rejected;
      });
      it('should not other key remove key', () => {
        return keyValueManager.set({key: 'foo', value: 'bar'})
        .then(() => keyValueManager.set({key: 'hello', value: 'world'}))
        .then(() => keyValueManager.delete({key: 'foo'}))
        .then(() => keyValueManager.has({key: 'hello'}))
        .then((exists) => expect(exists).to.be.true);
      });
      it('should emit the "delete" event', (done) => {
        const timeout = setTimeout(() => done(new Error('listener was not called')), 5);
        const listener = ({key}) => {
          clearTimeout(timeout);
          expect(key).to.equal('foo');
          done();
        };
        keyValueManager.once('delete', listener);
        keyValueManager.set({key: 'foo', value: 'bar'})
        .then(() => keyValueManager.delete({key: 'foo'}))
        .catch(done);
      });
    });

    describe('clear', () => {
      it('should remove key', () => {
        return keyValueManager.set({key: 'foo', value: 'bar'})
        .then(() => keyValueManager.clear())
        .then(() => keyValueManager.has({key: 'foo'}))
        .then((exists) => expect(exists).to.be.false);
      });
      it('should emit the "clear" event', (done) => {
        const timeout = setTimeout(() => done(new Error('listener was not called')), 5);
        const listener = () => {
          clearTimeout(timeout);
          done();
        };
        keyValueManager.once('clear', listener);
        keyValueManager.clear()
        .catch(done);
      });
    });

    describe('keys', () => {
      it('should contain added key', () => {
        return keyValueManager.set({key: 'foo', value: 'bar'})
        .then(() => keyValueManager.keys())
        .then((keys) => expect(keys).to.be.an('array').that.includes('foo'));
      });
      it('should not contain deleted key', () => {
        return keyValueManager.set({key: 'foo', value: 'bar'})
        .then(() => keyValueManager.delete({key: 'foo'}))
        .then(() => keyValueManager.keys())
        .then((keys) => expect(keys).to.be.an('array').to.not.include('foo'));
      });
    });

    describe('values', () => {
      it('should contain added value', () => {
        return keyValueManager.set({key: 'foo', value: 'bar'})
        .then(() => keyValueManager.values())
        .then((keys) => expect(keys).to.be.an('array').that.includes('bar'));
      });
      it('should not contain deleted value', () => {
        return keyValueManager.set({key: 'foo', value: 'bar'})
        .then(() => keyValueManager.delete({key: 'foo'}))
        .then(() => keyValueManager.values())
        .then((keys) => expect(keys).to.be.an('array').to.not.include('bar'));
      });
    });
  });
})();
