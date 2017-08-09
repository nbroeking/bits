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

  class ScopesUtil {
    constructor() {
      throw new Error('This is a static class do not create instance.');
    }

    static isValidScopes(scopes) {
      if (null === scopes) {
        return true;
      } else if (Array.isArray(scopes)) {
        return !scopes.some((scope) => !ScopesUtil.isValidScope(scope));
      } else {
        return false;
      }
    }

    static isValidScope(scope) {
      return ('string' === typeof(scope) && 0 < scope.length) ||
          ('object' === typeof(scope) && null !== scope &&
            'string' === typeof(scope.name) && 0 < scope.name.length &&
            'string' === typeof(scope.displayName) && 0 < scope.displayName.length);
    }
  }

  module.exports = ScopesUtil;
})();
