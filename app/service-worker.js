/**
 * @license
 * Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */

/* eslint no-console: ["error", { allow: ["info"] }] */

'use strict';

function isFunction(obj) {
  return obj && {}.toString.call(obj) === '[object Function]';
}

function runFunctionString(funcStr) {
  if (funcStr.trim().length > 0) {
    let func = new Function(funcStr);
    if (isFunction(func)) {
      func();
    }
  }
}

self.addEventListener('message', function(event) {
  self.client = event.source;
});

self.onnotificationclose = function(event) {
  runFunctionString(event.notification.data.onClose);

  /* Tell Push to execute close callback */
  self.client.postMessage(JSON.stringify({
    id: event.notification.data.id,
    action: 'close'
  }));
};

self.onnotificationclick = function(event) {
  let link;
  let origin;
  let href;

  runFunctionString(event.notification.data.onClick);

  if (typeof event.notification.data.link !== 'undefined' && event.notification.data.link !== null) {
    origin = event.notification.data.origin;
    link = event.notification.data.link;
    href = origin.substring(0, origin.indexOf('/', 8)) + '/';

    event.notification.close();

    /* This looks to see if the current is already open and focuses if it is */
    event.waitUntil(clients.matchAll({
      type: 'window'
    }).then(function(clientList) {
      let client;
      let fullUrl;

      for (let i = 0; i < clientList.length; i++) {
        client = clientList[i];
        fullUrl = href + link;

        if (fullUrl[fullUrl.length - 1] !== '/' && client.url[client.url.length - 1] === '/') {
          fullUrl += '/';
        }

        if (client.url === fullUrl && 'focus' in client) {
          return client.focus();
        }
      }

      if (clients.openWindow) {
        return clients.openWindow('/' + link);
      }
    }).catch(function(error) {
      throw new Error('A ServiceWorker error occurred: ' + error.message);
    }));
  }
};
