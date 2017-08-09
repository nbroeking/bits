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

  class DirectedEdge {
    constructor(v, w, weight) {
      if ('number' !== typeof (v) || 0 > v) {
        throw new TypeError('Vertex names must be nonnegative integers');
      }
      if ('number' !== typeof (w) || 0 > w) {
        throw new TypeError('Vertex names must be nonnegative integers');
      }
      if ('number' !== typeof (weight)) {
        throw new TypeError('Weight is NaN');
      }
      this._v = v;
      this._w = w;
      this._weight = weight;
    }

    from() {
      return this._v;
    }

    to() {
      return this._w;
    }

    weight() {
      return this._weight;
    }

    toString() {
      return this.from().toString() + '->' + this.to().toString() + ' ' + this.weight().toFixed(2);
    }
  }

  class EdgeWeightedDigraph {
    constructor(V) {
      if ('number' !== typeof (V) || 0 > V) {
        throw new TypeError('Number of vertices in a Digraph must be nonnegative');
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

    addEdge(e) {
      if (!(e instanceof DirectedEdge)) {
        throw new TypeError('e must be instance of DirectedEdge');
      }

      const v = e.from();
      const w = e.to();
      this._validateVertex(v);
      this._validateVertex(w);
      this._adj[v].push(e);
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

    edges() {
      const list = [];
      for (let v = 0; v < this.getV(); v++) {
        for (let e of this.adj(v)) {
          list.push(e);
        }
      }
      return list;
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

  module.exports = EdgeWeightedDigraph;
})();
