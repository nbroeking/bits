(() => {
  'use strict';

  const path = require('path');
  const chai = require('chai');
  const LazyRequireLoader = require('./../../lib/utils/lazy-require-loader');
  const TestApi = require('./test-api');

  const expect = chai.expect;
  const FILEPATH_TEST_API = path.join(__dirname, 'test-api');

  describe('LazyRequireLoader', () => {
    describe('add', () => {
      let loader = null;
      beforeEach('Create lazy loader', () => {
        loader = new LazyRequireLoader();
      });

      function createLoaderAdd(prop, filepath) {
        return function() {
          return loader.add(prop, filepath);
        };
      }

      it('should add property to loader', () => {
        loader.add('TestApi', FILEPATH_TEST_API);
        expect(loader.TestApi).to.equal(TestApi);
      });

      it('should throw error if prop is not a string', () => {
        expect(createLoaderAdd()).to.throw(TypeError, 'prop must be a non-empty string');
        expect(createLoaderAdd(false)).to.throw(TypeError, 'prop must be a non-empty string');
        expect(createLoaderAdd(42)).to.throw(TypeError, 'prop must be a non-empty string');
        expect(createLoaderAdd(null)).to.throw(TypeError, 'prop must be a non-empty string');
        expect(createLoaderAdd({})).to.throw(TypeError, 'prop must be a non-empty string');
        expect(createLoaderAdd(function() {})).to.throw(TypeError, 'prop must be a non-empty string');
      });

      it('should throw error if filepath is not a string', () => {
        expect(createLoaderAdd('TestApi')).to.throw(TypeError, /Path must be a string/);
      });

      it('should throw error if filepath is not an absolute path', () => {
        expect(createLoaderAdd('TestApi', './test')).to.throw(TypeError, 'filepath must be an absolute path');
      });
    });

    describe('remove', () => {
      let loader = null;
      beforeEach('Create lazy loader and add TestApi', () => {
        loader = new LazyRequireLoader();
        loader.add('TestApi', FILEPATH_TEST_API);
      });

      function createLoaderRemove(prop) {
        return function() {
          return loader.remove(prop);
        };
      }

      it('should delete property', () => {
        loader.remove('TestApi');
        expect(loader.TestApi).to.be.undefined;
      });

      it('should throw error if prop is not a string', () => {
        expect(createLoaderRemove()).to.throw(TypeError, 'prop must be a non-empty string');
        expect(createLoaderRemove(false)).to.throw(TypeError, 'prop must be a non-empty string');
        expect(createLoaderRemove(42)).to.throw(TypeError, 'prop must be a non-empty string');
        expect(createLoaderRemove(null)).to.throw(TypeError, 'prop must be a non-empty string');
        expect(createLoaderRemove({})).to.throw(TypeError, 'prop must be a non-empty string');
        expect(createLoaderRemove(function() { })).to.throw(TypeError, 'prop must be a non-empty string');
      });
    });
  });
})();
