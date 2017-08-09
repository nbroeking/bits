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

  function isArray(arr) {
    if (!Array.isArray(arr)) {
      throw new TypeError('arr must be an Array');
    }
  }

  function isCompareFunction(func) {
    if ('function' !== typeof (func)) {
      throw new TypeError('func must be a function');
    }
  }

  class UtilArray {
    static updateArray(current, update, compare) {
      isArray(current);
      isArray(update);
      isCompareFunction(compare);

      const removed = [];
      const added = [];

      current.sort(compare);
      update.sort(compare);

      let currentIndex = 0;
      let updateIndex = 0;

      while (currentIndex < current.length && updateIndex < update.length) {
        const currentItem = current[currentIndex];
        const updateItem = update[updateIndex];
        const cmp = compare(currentItem, updateItem);
        if (0 > cmp) {
          current.splice(currentIndex, 1);
          removed.push(currentItem);
        } else if (0 < cmp) {
          current.splice(currentIndex, 0, updateItem);
          added.push(updateItem);
          currentIndex++;
          updateIndex++;
        } else {
          currentIndex++;
          updateIndex++;
        }
      }

      while (currentIndex < current.length) {
        const currentItem = current[currentIndex];
        current.splice(currentIndex, 1);
        removed.push(currentItem);
      }

      while (updateIndex < update.length) {
        const updateItem = update[updateIndex];
        current.splice(currentIndex, 0, updateItem);
        added.push(updateItem);
        currentIndex++;
        updateIndex++;
      }

      return {
        isDirty: 0 < added.length || 0 < removed.length,
        hasRemoved: 0 < removed.length,
        hasAdded: 0 < added.length,
        removed: removed,
        added: added,
      };
    }

    static binarySearch(arr, element, compare) {
      isArray(arr);
      isCompareFunction(compare);

      let minIndex = 0;
      let maxIndex = arr.length - 1;
      let currentIndex = -1;

      while (minIndex <= maxIndex) {
        currentIndex = Math.floor((minIndex + maxIndex) / 2);
        const currentElement = arr[currentIndex];
        const cmp = compare(element, currentElement);
        if (0 > cmp) {
          maxIndex = currentIndex - 1;
        } else if (0 < cmp) {
          minIndex = currentIndex + 1;
        } else {
          return currentIndex;
        }
      }
      return -1;
    }
  }

  module.exports = UtilArray;
})();
