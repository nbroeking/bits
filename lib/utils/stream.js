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

  const stream = require('stream');

  class BufferReadStream extends stream.Readable {
    constructor(buffer, options) {
      super(options);

      if (!Buffer.isBuffer(buffer)) {
        throw new TypeError('buffer must be a Buffer');
      }

      this.buffer = buffer;
      this.start = 0;
    }

    _read(n) {
      const readEnd = this.start + n;

      while (this.start < readEnd && this.start < this.buffer.length) {
        let end = this.buffer.length;

        if (readEnd < end) {
          end = readEnd;
        }

        const chunk = this.buffer.slice(this.start, end);

        this.start = end;

        if (!this.push(chunk)) {
          break;
        }
      }

      if (this.start >= this.buffer.length) {
        this.push(null);
      }
    }
  }

  class UtilStream {
    constructor() {
      throw new Error('do not create an instance');
    }

    static get BufferReadStream() {
      return BufferReadStream;
    }
  }

  module.exports = UtilStream;
})();
