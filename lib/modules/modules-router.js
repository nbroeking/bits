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

  const multer = require('multer');
  const logger = require('./../logging/logger-factory').getLogger();
  const passport = require('passport');
  const bodyParser = require('body-parser');
  const CrudRouter = require('./../helpers/crud-router');
  const os = require('os');

  class ModuleRouter extends CrudRouter {
    constructor(manager, {readScopes=null, writeScopes=null, routePath}) {
      super(manager, {readScopes: readScopes, writeScopes: writeScopes, routePath: routePath});
      this._moduleManager = manager;
      this._modulesDir = manager.getModuleDir();
      this._modulePackageService = null; // Will get set in load
      this._modulesPackagesUploadDir = os.tmpdir();

      this._router.use(bodyParser.urlencoded({extended: false}));
      this._router.use(bodyParser.json());
      this._router.use(passport.authenticate('bearer', {session: false}));

      const storage = multer.diskStorage({
        destination: (req, file, cb) => {
          cb(null, this._modulesPackagesUploadDir);
        },
      });

      const upload = multer({storage: storage});
      this._router.post('/module-packages', upload.any(), (...data) => this._upload(...data));
    }

    load(...args) {
      this._modulePackageService = this._moduleManager.getModulePackageService();
      return super.load(...args);
    }

    _upload(req, res, next) {
      if (!Array.isArray(req.files) || 0 >= req.files.length) {
        logger.error('Module Package API hit with no Module Package');
        res.status(400).json({
          success: false,
          error: {
            name: 'Error',
            message: 'Must have module package(s)',
          },
        });
        return;
      } else {
        const files = req.files;
        Promise.all(files.map((file) => this._modulePackageService.installModule(file)))
        .then(() => {
          res.status(200).json({
            success: true
          });
        })
        .catch((err) => {
          logger.error('Error handling upload of module', err);
          next(new Error('unable to process module'));
        });
      }
    }
  }

  module.exports = ModuleRouter;
})();
