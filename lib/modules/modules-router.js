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

  const express = require('express');
  const multer = require('multer');
  const UtilFs = require('./../helpers/fs');
  const logger = require('./../logging/logger-factory').getLogger();
  const passport = require('passport');
  const Router = express.Router;
  const bodyParser = require('body-parser');

  class ModuleRouter {
    constructor(moduleManager, modulesDir, uploadDir) {
      this._moduleManager = moduleManager;
      this._modulesDir = modulesDir;
      this._modulesPackagesUploadDir = uploadDir;

      this._router = new Router();
      this._router.use(bodyParser.urlencoded({extended: false}));
      this._router.use(bodyParser.json());
      this._router.use(passport.authenticate('bearer', {session: false}));

      const storage = multer.diskStorage({
        destination: (req, file, cb) => {
          cb(null, this._modulesPackagesUploadDir);
        },
      });

      const upload = multer({storage: storage});

      this._router.param('name', () => this._getModuleByName);
      this._router.route('/')
      .get((...data) => this._getModuleList(...data))
      .post(upload.any(), (...data) => this._upload(...data))
      .delete((...data) => this._delete(...data));

      this._router.route('/:name')
      .post((...data) => this._installAndLoad(...data))
      .delete((...data) => this._unload(...data));
    }

    _installAndLoad(req, res) {
      // Get the module for this request
      const mod = req.module;

      // Get the 'version' from the request
      const version = req.body.version;

      return Promise.resolve()
      .then(() => {
        if (!mod.isInstalled || mod.isBase) {
          return this._moduleManager.installModule(mod, version);
        }
      })
      .then(() => {
        return this._moduleManager.loadModule(mod);
      })
      .then(() => {
        res.status(200).json({success: true});
      })
      .catch((err) => {
        res.status(500).json({success: false, err: err.toString()});
      });
    }

    _unload() {
      // Get the module for this request
      const mod = req.module;
      return Promise.resolve()
      .then(() => {
        if (mod.isLoaded) {
          return this._moduleManager.unloadModule(mod);
        }
      })
      .then(() => {
        return this._moduleManager.uninstallModule(mod);
      })
      .then(() => {
        res.status(200).json({success: true});
      })
      .catch((err) => {
        res.status(500).json({success: false, err: err.toString()});
      });
    }

    _getModuleByName(req, res, next, name) {
      // Get module from the module manager
      const mod = this._moduleManager.getModuleFromName(name);

      // Make sure the module exists
      if (mod) {
        req.module = mod;
        next();
      } else {
        res.status(404).json({success: false, err: 'No module found with name ' + name});
      }
    }

    _getModuleList(req, res) {
      return this._moduleManager.getModuleList()
      .then((modules) => {
        res.status(200).json(modules);
      })
      .catch((err) => {
        res.status(500).json({success: false, err: err.toString()});
      });
    }

    _upload(req, res, next) {
      if (!Array.isArray(req.files) || 0 >= req.files.length) {
        res.status(400).json({
          success: false,
          error: {
            name: 'Error',
            message: 'Must have module package(s)',
          },
        });
        return;
      } else {
        const response = {
          success: true,
          operations: {},
        };
        const files = req.files;

        Promise.all(files.map((file) => {
          const operation = {
            success: false,
            moduleInfo: null,
            errors: [],
          };

          return this._moduleManager.addModulePackage(file.path)
          .then((moduleInfo) => {
            operation.success = true;
            operation.moduleInfo = {
              name: moduleInfo.name,
              version: moduleInfo.version,
              dependencies: moduleInfo.dependencies,
            };
          })
          .catch((err) => {
            logger.error('Failed to add module package %s', file.originalname, {
              filepath: file.path,
              error: {
                name: err.name,
                message: err.message,
              },
            });
            operation.success = false;
            operation.errors.push({name: err.name, message: err.message});
          })
          .then(() => UtilFs.unlink(file.path))
          .catch((err) => {
            operation.errors.push({name: err.name, message: err.message});
          })
          .then(() => {
            response[file.originalname] = operation.success;
            response.operations[file.originalname] = operation;
            if (!operation.success) {
              response.success = false;
            }
          });
        }))
        .then(() => {
          if (response.success) {
            res.status(200).json(response);
          } else {
            res.status(400).json(response);
          }
        })
        .catch(next);
      }
    }

    _delete(req, res) {
      const name = req.body.name;
      const version = req.body.version;

      this._moduleManager.remove(name, version)
      .then((result) => {
        res.status(200).json({success: true, data: result});
      })
      .catch((err) => {
        res.status(500).json({success: false, err: err.toString()});
      });
    }


    getRouter() {
      return this._router;
    }
  }

  module.exports = ModuleRouter;
})();
