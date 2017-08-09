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

  const Digraph = require('./digraph');
  const BreadthFirstDirectedPaths = require('./breadth-first-directed-paths');

  module.exports.Digraph = Digraph;

  let DepthFirstOrder = function(G) {
    this._marked = [];
    this._pre = [];
    this._post = [];
    this._preorder = [];
    this._postorder = [];
    this._preCounter = 0;
    this._postCounter = 0;

    // Initialize
    for (let i = 0; i < G.getV(); i++) {
      this._marked.push(false);
      this._pre.push(-1);
      this._post.push(-1);
    }

    for (let v = 0; v < G.getV(); v++) {
      if (!this._marked[v]) {
        this._dfs(G, v);
      }
    }
  };
  module.exports.DepthFirstOrder = DepthFirstOrder;

  DepthFirstOrder.prototype._dfs = function(G, v) {
    this._marked[v] = true;
    this._pre[v] = this._preCounter++;
    this._preorder.push(v);
    let adjv = G.adj(v);
    for (let i = 0; i < adjv.length; i++) {
      let w = adjv[i];
      if (!this._marked[w]) {
        this._dfs(G, w);
      }
    }
    this._postorder.push(v);
    this._post[v] = this._postCounter++;
  };

  DepthFirstOrder.prototype.pre = function() {
    return this._preorder;
  };

  DepthFirstOrder.prototype.post = function() {
    return this._postorder;
  };

  DepthFirstOrder.prototype.reversePost = function() {
    let reverse = [];
    for (let i = 0; i < this._postorder.length; i++) {
      let v = this._postorder[i];
      reverse.unshift(v);
    }
    return reverse;
  };

  let DirectedCycle = function(G) {
    this._marked = [];
    this._edgeTo = [];
    this._onStack = [];
    this._cycle = null;

    // Initialize
    for (let i = 0; i < G.getV(); i++) {
      this._marked.push(false);
      this._edgeTo.push(-1);
      this._onStack.push(false);
    }

    for (let v = 0; v < G.getV(); v++) {
      if (!this._marked[v]) {
        this._dfs(G, v);
      }
    }
  };

  DirectedCycle.prototype._dfs = function(G, v) {
    this._marked[v] = true;
    this._onStack[v] = true;

    let adjv = G.adj(v);
    for (let i = 0; i < adjv.length; i++) {
      let w = adjv[i];

      // short circuit if directed cycle found
      if (this._cycle) {
        return;
      } else if (!this._marked[w]) {
        // found new vertex, so recur
        this._edgeTo[w] = v;
        this._dfs(G, w);
      } else if (this._onStack[w]) {
        // trace back directed cycle
        this._cycle = [];
        for (let x = v; x !== w; x = this._edgeTo[x]) {
          this._cycle.unshift(x);
        }
        this._cycle.unshift(w);
        this._cycle.unshift(v);
      }
    }

    this._onStack[v] = false;
  };

  DirectedCycle.prototype.hasCycle = function() {
    return (null !== this._cycle);
  };

  DirectedCycle.prototype.cycle = function() {
    return this._cycle;
  };
  module.exports.DirectedCycle = DirectedCycle;

  class Topological {
    constructor(G) {
      const finder = new DirectedCycle(G);
      if (!finder.hasCycle()) {
        let dfs = new DepthFirstOrder(G);
        this._order = dfs.reversePost();
      } else {
        this._order = null;
      }
    }

    hasOrder() {
      return (null !== this._order);
    }

    order() {
      return this._order;
    }
  }
  module.exports.Topological = Topological;

  module.exports.BreadthFirstDirectedPaths = BreadthFirstDirectedPaths;
})();
