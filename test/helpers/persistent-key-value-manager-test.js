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
  const fs = require('fs');
  const PersistentKeyValueManager = require('./../../lib/helpers/persistent-key-value-manager');
  const os = require('os');
  const path = require('path');
  const UtilFs = require('./../../lib/helpers/fs');

  const {expect} = chai;

  describe('PersistentKeyValueManager', () => {
    let tmpdir = null;
    beforeEach('Create temp dir', (done) => {
      fs.mkdtemp(path.join(os.tmpdir(), 'persistent-key-value-manager-'), (err, folder) => {
        if (err) {
          done(err);
        } else {
          tmpdir = folder;
          done();
        }
      });
    });

    let manager = null;
    beforeEach('Create manager', () => {
      manager = new PersistentKeyValueManager({location: tmpdir});
      return manager.open();
    });

    afterEach('Delete manager', () => {
      return manager.close()
      .then(() => {
        manager = null;
      });
    });

    afterEach('Delete temp dir', () => {
      return UtilFs.rmdir(tmpdir, {recursive: true})
      .then(() => {
        tmpdir = null;
      });
    });

    describe('set', () => {
      it('should set a value', () => {
        return manager.set({key: 'foo', value: 'bar'});
      });

      it('should emit the "set" event', (done) => {
        const timeout = setTimeout(() => {
          manager.removeListener('set', onSet);
          done(new Error('listener was not called'));
        }, 10);
        function onSet({key, value}) {
          clearTimeout(timeout);
          expect(key).to.equal('foo');
          expect(value).to.equal('bar');
          done();
        }
        manager.on('set', onSet);
        manager.set({key: 'foo', value: 'bar'})
        .catch(done);
      });
    });

    describe('get', () => {
      it('should get a value', () => {
        return manager.set({key: 'foo', value: 'bar'})
        .then(() => manager.get({key: 'foo'}))
        .then((value) => expect(value).to.equals('bar'));
      });
      it('should reject if key does not exist', () => {
        return expect(manager.get({key: 'does-not-exist'})).to.be.rejected;
      });
    });

    describe('has', () => {
      it('should resolve to true if key exists', () => {
        return manager.set({key: 'foo', value: 'bar'})
        .then(() => manager.has({key: 'foo'}))
        .then((exists) => expect(exists).to.be.true);
      });
      it('should resolve to false if key does not exist', () => {
        return manager.has({key: 'foo'})
        .then((exists) => expect(exists).to.be.false);
      });
    });

    describe('delete', () => {
      it('should remove key', () => {
        return manager.set({key: 'foo', value: 'bar'})
        .then(() => manager.delete({key: 'foo'}))
        .then(() => manager.has({key: 'foo'}))
        .then((exists) => expect(exists).to.be.false);
      });
      it('should reject if key does not exist', () => {
        return expect(manager.delete({key: 'does-not-exist'})).to.be.rejected;
      });
      it('should not other key remove key', () => {
        return manager.set({key: 'foo', value: 'bar'})
        .then(() => manager.set({key: 'hello', value: 'world'}))
        .then(() => manager.delete({key: 'foo'}))
        .then(() => manager.has({key: 'hello'}))
        .then((exists) => expect(exists).to.be.true);
      });
      it('should emit the "delete" event', (done) => {
        const timeout = setTimeout(() => {
          manager.removeListener('delete', onDelete);
          done(new Error('listener was not called'));
        }, 10);
        function onDelete({key}) {
          clearTimeout(timeout);
          expect(key).to.equal('foo');
          done();
        };
        manager.once('delete', onDelete);
        manager.set({key: 'foo', value: 'bar'})
        .then(() => manager.delete({key: 'foo'}))
        .catch(done);
      });
    });

    describe('clear', () => {
      it('should remove key', () => {
        return manager.set({key: 'foo', value: 'bar'})
        .then(() => manager.clear())
        .then(() => manager.has({key: 'foo'}))
        .then((exists) => expect(exists).to.be.false);
      });
      it('should emit the "clear" event', (done) => {
        const timeout = setTimeout(() => {
          manager.removeListener('clear', onClear);
          done(new Error('listener was not called'));
        }, 10);
        function onClear() {
          clearTimeout(timeout);
          done();
        };
        manager.once('clear', onClear);
        manager.clear()
        .catch(done);
      });
    });

    describe('keys', () => {
      it('should contain added key', () => {
        return manager.set({key: 'foo', value: 'bar'})
        .then(() => manager.keys())
        .then((keys) => expect(keys).to.be.an('array').that.includes('foo'));
      });
      it('should not contain deleted key', () => {
        return manager.set({key: 'foo', value: 'bar'})
        .then(() => manager.delete({key: 'foo'}))
        .then(() => manager.keys())
        .then((keys) => expect(keys).to.be.an('array').to.not.include('foo'));
      });
    });

    describe('values', () => {
      it('should contain added value', () => {
        return manager.set({key: 'foo', value: 'bar'})
        .then(() => manager.values())
        .then((keys) => expect(keys).to.be.an('array').that.includes('bar'));
      });
      it('should not contain deleted value', () => {
        return manager.set({key: 'foo', value: 'bar'})
        .then(() => manager.delete({key: 'foo'}))
        .then(() => manager.values())
        .then((keys) => expect(keys).to.be.an('array').to.not.include('bar'));
      });
    });
  });
})();
