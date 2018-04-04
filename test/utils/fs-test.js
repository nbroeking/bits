(() => {
  'use strict';

  const chai = require('chai');
  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  const UtilFs = require('./../../lib/helpers/fs');

  const {expect} = chai;

  function readdir(path, options) {
    return new Promise((resolve, reject) => {
      fs.readdir(path, options, (err, folder) => {
        if (err) {
          reject(err);
        } else {
          resolve(folder);
        }
      });
    });
  }

  function stat(path) {
    return new Promise((resolve, reject) => {
      fs.stat(path, (err, stats) => {
        if (err) {
          reject(err);
        } else {
          resolve(stats);
        }
      });
    });
  }

  function unlink(path) {
    return new Promise((resolve, reject) => {
      fs.unlink(path, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  function rmdir(path) {
    return new Promise((resolve, reject) => {
      fs.rmdir(path, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  function rmdirr(dirpath) {
    return readdir(dirpath)
    .then((filenames) => {
      const filepaths = filenames.map((filename) => path.join(dirpath, filename));
      return Promise.all(filepaths.map((filepath) => {
        return stat(filepath)
        .then((stats) => {
          if (stats.isDirectory()) {
            return rmdirr(filepath);
          } else {
            return unlink(filepath);
          }
        });
      }));
    })
    .then(() => rmdir(dirpath));
  }

  function mkdtemp(path, options) {
    return new Promise((resolve, reject) => {
      fs.mkdtemp(path, options, (err, folder) => {
        if (err) {
          reject(err);
        } else {
          resolve(folder);
        }
      });
    });
  }

  describe('UtilFs', () => {
    describe('mkdirp', () => {
      let tmpdir = null;
      beforeEach('Create temp dir', () => {
        return mkdtemp(path.join(os.tmpdir(), 'util-fs-'))
        .then((folder) => {
          tmpdir = folder;
        });
      });

      afterEach('Delete temp dir', () => {
        return rmdirr(tmpdir);
      });

      it('should create multiple directories', () => {
        const dirpath = path.join(tmpdir, 'foo/bar');
        return UtilFs.mkdirp(dirpath)
        .then(() => stat(dirpath))
        .then((stats) => {
          expect(stats.isDirectory()).to.be.true;
        });
      });
    });
  });
})();
