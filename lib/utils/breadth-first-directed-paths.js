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

  class BreadthFirstDirectedPaths {
    constructor(G, s) {
      this._marked = [];
      this._distTo = [];
      this._edgeTo = [];
      for (let v = 0; v < G.getV(); v++) {
        this._marked.push(false);
        this._distTo.push(Number.MAX_VALUE);
        this._edgeTo.push(-1);
      }
      this._bfs(G, s);
    }

    _bfs(G, s) {
      const q = [];

      this._distTo[s] = 0;
      this._marked[s] = true;

      q.push(s);

      while (0 < q.length) {
        const v = q.shift();
        for (const w of G.adj(v)) {
          if (!this._marked[w]) {
            this._edgeTo[w] = v;
            this._distTo[w] = this._distTo[v] + 1;
            this._marked[w] = true;
            q.push(w);
          }
        }
      }
    }

    hasPathTo(v) {
      return this._marked[v];
    }

    distTo(v) {
      return this._distTo[v];
    }

    pathTo(v) {
      if (!this.hasPathTo(v)) {
        return null;
      }
      const path = [];
      let x;
      for (x = v; this._distTo[x] !== 0; x = this._edgeTo[x]) {
        path.unshift(x);
      }
      return path;
    }
  }

  module.exports = BreadthFirstDirectedPaths;
})();
