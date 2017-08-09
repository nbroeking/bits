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

  const os = require('os');

  class Digraph {
    constructor(V) {
      if ('number' !== typeof (V)) {
        throw new TypeError('V must be a number');
      } else if (0 > V) {
        return new TypeError('Number of vertices in a Digraph must be nonnegative');
      }

      this._V = V;
      this._E = 0;
      this._indegree = [];
      this._adj = [];

      for (let v = 0; v < V; v++) {
        this._indegree.push(0);
        this._adj.push([]);
      }
    }

    getV() {
      return this._V;
    }

    getE() {
      return this._E;
    }

    _validateVertex(v) {
      if (0 > v || this._V <= v) {
        throw new TypeError('vertex ' + v + ' is not between 0 and ' + (this._V - 1));
      }
    }

    addEdge(v, w) {
      this._validateVertex(v);
      this._validateVertex(w);
      this._adj[v].push(w);
      this._indegree[w]++;
      this._E++;
    }

    adj(v) {
      this._validateVertex(v);
      return this._adj[v];
    }

    outdegree(v) {
      this._validateVertex(v);
      return this._adj[v].length;
    }

    indegree(v) {
      this._validateVertex(v);
      return this._indegree[v];
    }

    reverse() {
      const R = new Digraph(this.getV());
      for (let v = 0; v < this.getV(); v++) {
        for (let w of this.adj(v)) {
          R.addEdge(w, v);
        }
      }
      return R;
    }

    toString() {
      let s = '';

      s += this.getV().toString() + ' vertices, ' + this.getE().toString() + ' edges' + os.EOL;

      for (let v = 0; v < this.getV(); v++) {
        s += v.toString() + ': ';
        for (let w of this.adj(v)) {
          s += w.toString() + ' ';
        }
        s += os.EOL;
      }

      return s;
    }
  }

  module.exports = Digraph;
})();
