BITS
===

<!-- MarkdownTOC autolink="true" bracket="round" depth="2" indent="    " -->

- [What is BITS?](#what-is-bits)
- [Quickstart](#quickstart)
- [Modules](#modules)
    - [package.json](#packagejson)
    - [module.json](#modulejson)
    - [index.js](#indexjs)
- [Optimized Module Groupings](#optimized-module-groupings)
- [Scopes](#scopes)
- [MessageCenter](#messagecenter)
    - [Server Side](#server-side)
- [Base APIs](#base-apis)
    - [Activity](#activity)
    - [System](#system)
    - [Authentication](#authentication)
    - [Helper](#helper)
    - [Others](#others)
- [Module APIs](#module-apis)
- [Base Server](#base-server)
- [Authentication](#authentication-1)
    - [API](#api)
- [Helper Classes](#helper-classes)
    - [Base Server](#base-server-1)
    - [Child Process](#child-process)
    - [CRUD API](#crud-api)
    - [CRUD Manager](#crud-manager)
    - [CRUD Messenger](#crud-messenger)
    - [Daemon](#daemon)
    - [FS](#fs)
    - [Lazy Load](#lazy-load)
    - [Messenger](#messenger)
    - [Others](#others-1)
- [Development](#development)
- [Running BITS](#running-bits)
- [Running Modules](#running-modules)
- [Support](#support)
- [Tutorials](#tutorials)

<!-- /MarkdownTOC -->


# What is BITS?

BITS (BITS Integrated Technology System) is designed to allow for the rapid development of modules that share base software. It is based on Google's polymer project and node.js. The goal is to reuse common components in multiple projects and harden these components through extensive use.

BITS can run on enterprise or embedded applications and can help jumpstart a project with initial functionality. A basic BITS implementation provides the following initial capabilities:

* User Authentication and Scopes
* Dashboard homepage for widgets
* Activity Log
* Module management
* OMG management
* Centralized system logging

---

# Quickstart

It is always a good idea to make sure your host system is up to date. On Ubuntu systems it may prove useful to run apt-get upgrade before beginning.

``` bash
# Install Node.js v6.x python-crypto python-serial python-netifaces python-magic
apt-get install python-crypto python-serial python-netifaces python-magic
curl -sL https://deb.nodesource.com/setup_6.x | sudo -E bash -
sudo apt-get install -y nodejs

# Setup development environment
npm run build

# Add Yarn
node ./support/development/yarn-legacy-0.19.1.js add --dev <node-pkg-name>

# Start BITS
npm run dev
```

BITS should now be running and is accessible at https://localhost:9001

# Modules

BITS is a framework built around modules. The base BITS framework is made useful with the creation and addition of module functionality. A module is run by BITS and provides a concrete and specific feature addition to the system. Examples of modules are GNSS (GPS), Networking, and MongoDB. Chances are you are interested in BITS as a means to build a module, or to use somebody else's module. Groups of modules that work together for a specific use case are Optimized Module Groupings (OMG).

Every module runs inside their own process and are installed to the base data directory in &lt;datadir&gt;/base/modules/modules.

## package.json

The package.json file specifies all the scripts and npm configurations for the bits module. Every package.json should have a scripts section with two scripts specified. bits:install and build. bits:install will run when an OMG or a module is uploaded to the system. bits:install should run everything your module needs to run on the system. bits:build is what is used to do a comprehensive build. This should include lint checks as well as running bits:install.

## module.json

BITS requires every module to have a module.json file. The module.json specifies information specific to that module including its name, version, scopes, and widgets.

## index.js

An index.js needs to be specified to run module code. The index.js should export two functions, load and unload. These methods pass the messageCenter for communication to other modules. There are additional details in following sections. The index.js should look like:

```javascript
(() => {
  'use strict';

  class MyModule {

    load(messageCenter) {
      return Promise.resolve();
    }

    unload(messageCenter) {
      return Promise.resolve();
    }
  }

  module.exports = new MyModule();
})();

```

---

# Optimized Module Groupings

An Optimized Module Grouping (OMG) is a group of modules that make up a specific application.

BITS uses OMGs to distribute groups of modules to the system. OMGs consist of a base version and a group of modules. When the OMG is loaded, the base will upgrade to the base in the OMG, install all the modules, and load them.

---

# Scopes

Bits uses an attribute based architecture for access control. Each user is assigned a set of scopes. The user is then only able to make requests or receive events that are tagged with the same scope as the request or event is tagged with. Normally, when a request or event listener is added the message center, the author specifies the scopes attribute in the second parameter.

ex

``` javascript

this._messageCenter.addRequestListener('myEvent', {scopes: ['scope1', 'scope2']}, func);
```

In this example only users that have the attributes of scope1 or scope2 will successfully make the request.

Note: if scopes is null that means that no user can make the request and only server side code has access to the api.

---

# MessageCenter

The core infrastructure to BITS is based around a system called the message center. The message center acts as an Inter Process Communication (IPC). All modules can use the message center to communicate data between each other as well as to the UI. The underlying framework of registering/deregistering for events is handled by MessageCenter.

#### Request Listeners

Request listeners are used to return a value back to the original requester. If one module adds a listener like:

``` javascript
this._messageCenter.addRequestListener('myEvent', {scopes: null}, (name) => {
  return 'Hello ' + name;
})
```

Then a user on the server side can make a request to this api such as.

``` javascript
this._messageCenter.sendRequest('myEvent', {scopes: null}, 'Nic')
.then((response) => {
  console.log('The server said', response);
});
```

The resulting output would be "The server said Hello Nic"

Note: On the client side you do not need to specify the scopes object as the server side will attach the appropriate user scopes to the request.

#### Event Listeners

Event listeners are used if a module has a change of data that he needs to update all the other modules with.

If client module adds a listener like:

``` javascript
this._messageCenter.addEventListener('myEvent', {scopes: null}, (name) => {
  console.log('The server said Hello ', name);
})
```

Then anytime the server sends the event with data the function will fire.

``` javascript
this._messageCenter.sendEvent('myEvent', {scopes: null}, 'Nic');
```

The output from this will be "The server said Hello Nic";

Note: There are very few instances when you will have to directly access the message center normally you should use helper constructs or modules like settings, or crud;

## Server Side

The server side can add event listeners and request listeners by using a reference of the MessageCenter passed to the module during load. In order to do this you can call `messageCenter.addRequestListener(request, metadata, listener)` and `messageCenter.addEventListener(event, metadata, listener)`.

Event listeners are a one-to-many call. Many actors can subscribe to a single event. Anytime that event is sent on the message center, each one of them will get it. No response is sent back from event emitters.

Request listeners are many-to-one. Only one actor can add a request listener, however, any actor can send a request for that data. Send request returns a promise with the data from the request listener return statement.

In order to send an event and request from the server side, you can use `messageCenter.sendRequest(request, metadata)` and `messageCenter.sendEvent(event, metadata)`

### Metadata

The metadata object is associated with all requests. It contains information about what made the request so data can be filtered appropriately. The client manager acts as a filter from all client side requests. It ensures the user's information is entered into the metadata.

The metadata has two fields and these fields can influence how the message center passes messages.

The format is
```javascript
{
  "scopes": ["public", "..."],
  "user": {
    "id": "",
    "username": "",
    ...
  }
}
```
The user field takes precedence over the scopes field. For example, if scopes and a user are specified then the user rule overrides the scopes rules.

For the rules, the requester is the actor calling sendRequest and the handler is the requestListener.

1. Scopes
    1. If handler scopes is `null`, then filter all requests.
    1. If requester scopes is `null`, then do not filter any requests.
    1. If both handler and requester have scopes, then filter if none of the scopes in the requester are in the handler.
1. User
    1. If handler user is specified, then only that user can see the data.
    1. If handler user is not defined, but request user is, then default back to scopes rules.
    1. If handler user is specified and requester user is not, then default back to scopes rules.

### Example

```javascript
(() => {
  'use strict';

  class MyModule {
    constructor() {
      this._boundOnEvent = this._event.bind(this);
      this._boundHandleRequest = this._handleRequest.bind(this);
    }

    load(messageCenter) {
      return Promise.resolve()
      .then(() => messageCenter.addEventListener('event', {scopes: ['public']}, this._boundOnEvent))
      .then(() => messageCenter.addRequestListener('request', {scopes: ['public']}, this._boundHandleRequest))
      .then(() => messageCenter.sendRequest(request, {scopes: null}))
      .then((response) => {
        //response
      });
    }

    unload(messageCenter) {
      return Promise.resolve()
      .then(() => messageCenter.removeRequestListener(() => messageCenter.removeRequestListener('request', this._boundHandleRequest)))
      .then(() => messageCenter.removeEventListener('event', this._boundOnEvent));
    }

    _event(data) {
      //Do something with event
    }

    _handleRequest(metadata, data) {
      return Promise.resolve({data: 'data'});
    }
  }

  module.exports = new MyModule();
})();

```

### Recommended Pattern

The above example is how one would directly add request listeners. However, this is not the recommended pattern. Instead we have developed a messenger pattern. Every subsystem should consist of 4 parts.

1. **Manager:** The manager is responsible for managing the data and flow of information.
1. **Messenger:** The messenger is responsible for adding request and event listeners to the message center and passing along all requests to the master.
1. **API:** The api element is a wrapper around sendRequests to all of the messengers calls. This allows modules to not have to change their code if the underlying request names change.
1. **Router** More on this later but the router has the same role as the messenger but passes along REST API calls.

Examples of these can all be seen in the base under each of the subsystems or by checking out the tutorial projects.

---

# Base APIs

In the message center we showed you the API pattern. BITS base implements several APIs that you can use to interact with the system.

## Activity

The activity API provides a way for modules to add events to the activity. All activities show up under the base tab as well as in the notifications list on the nav bar.

## System

Base has a system API that allows modules to get the BITS ID as well as restart, and shutdown the system.

## Authentication

Base also has an API that allows modules to interact with the OMG and module subsystem to load, and unload modules.

## Helper

The helper API is used for modules to be able to add helper classes to the global. Helpers can be anything from helper classes, to API objects, or anything that you need other modules to be able to require.

Add something to `global`:

```javascript
return Promise.resolve()
.then(() => {
  this._baseHelperApi = new global.helper.BaseHelperApi(messageCenter);
})
.then(() => this._baseHelperApi.add({name: 'NameOfClass', filepath: pathtoFile}));
```

## Others

Base is constantly being developed and improved. The base has a file called bits-base.js where all of bases APIs are added to the global. Check here for all current helpers and APIs for your modules to use.

---

# Module APIs

Each module is responsible for opening up its own API to the system if it wants to provide services for other modules to use. This should be done through the message center and can be done by adding request listeners. Anytime a module makes a request, the modules request listener will handle the requests. Base provides APIs for modules to use and can be seen under the messengers folder. Each messenger opens up an API to the individual managers/subsystems. To add APIs for other modules to use, look at the helper API in the previous section.

---

# Base Server

The base hosts a web server that handles all web requests that are made to base. Base also acts as a proxy server, if modules want to add routes and endpoints they can subscribe the route with the base and get the request forwarded via proxy. To utilize this function use the BaseServer helper. More information on this below.

# Authentication

BITS uses an access token based protocol for its authentication. When a user logs in they are granted an access token from the system. This access token must then be added to all future requests in order for the client manager to allow the request to be proxied.

## API

1. Login `https://<device>/api/base/auth/signin` - must have data `{username: <username>, password: <password>}`
1. Verify `https://<device>/api/base/auth/verify` - data `{token: <accessToken>}`

*Client side management of the access token is managed by the message center for you. This only applies to accessing REST APIs.*

---

# Helper Classes

Base provides several helper classes to enable modules to easily perform tasks.

## Base Server

The base server provides a helper object that can interact with the base to set up routers. The base acts as a proxy to forward all web requests to the appropriate module.

## Child Process

The child process helper provides a way for modules to CRUD scripts on the system.
```javascript

const UtilFs = global.helper.FS;

return UtilFs.createSpawnPromise('ls', ['-alh'])
.then((contents) => {
  //The contents
});

```

## CRUD API

The CRUD API is an API helper that can make calls to any other CRUD subsystem.

## CRUD Manager

The CRUD manager is a super class that creates a CRUD subsystem. See the CRUD Section.

## CRUD Messenger

The CRUD messenger is the helper object that the CRUD Manager uses to add its listener to the message center. Your messenger can be overloaded with the CRUD Messenger if you want to provide the basic CRUD API without having to implement the CRUD Manager. Or you can use it to extend the basic CRUD API.

## Daemon

The daemon class can be used to start daemons or long running scripts. The daemon class ensures restart functionality as well as exit handling in case BITS tries to shutdown.


```javascript
const Daemon = global.helper.Deamon;

const daemon = new Daemon('myDaemonCommand', ['options'], {restart: true});
daemon.on('stdout', (stdout) => {});
daemon.on('stderr', (stderr) => {});
daemon.on('exit', () => {});

return daemon.start();

// Some time later

daemon.shutdown();
```

## FS

The fs helper provides a list of functions that allows modules to be able to interact with the host file system. The normal use case is writing a file to the modules data directory.

```javascript
this._modManApi.getDataDirectory('mod-name')
.then((dir) => {
  return UtilFs.readFile(path.resolve(dir, './contents.txt', {options}))
  .then((fileContents) => {
    //The file contents
  });
});
```

## Lazy Load

The lazy load helper uses another modules apis without a hard dependency on the module. If the target module loads the then lazy load will call `onModuleLoad` and `onModuleUnload` respectively.

## Messenger

The messenger subclass provides a `requestListener` manager that allows for an easier api to add listeners to the message center. All messengers should inherit from this subclass.

## Others

All helpers can be found inside the helpers directory under lib. Check out the folder to see what other functions these helpers have. In many situations a solution to your problem could already be implemented here. Also make sure to check the npm store. NPM has thousands of additional helper objects.

---

# Development

BITS 2.x is a Node.js v6.x application. To installed Node.js on your machine visit the <a href="https://nodejs.org/en/" target="_blank">Node.js</a> website. The <a href="https://yarnpkg.com/" target="_blank">yarn</a> package manager is used to install node packages. BITS 2.x also uses <a href="https://bower.io/" target="_blank">bower</a> package manager for UI package dependencies. To setup the development environment install Node.js v6.x and run the npm `build` script.

``` bash
# Install Node.js v6.x python-crypto python-serial python-netifaces python-magic
curl -sL https://deb.nodesource.com/setup_6.x | sudo -E bash -
sudo apt-get install -y nodejs

# Setup development environment
npm run build
```

**Add node package**

```bash
# Production
node ./support/development/yarn-legacy-0.19.1.js add <node-pkg-name>

# Development
node ./support/development/yarn-legacy-0.19.1.js add --dev <node-pkg-name>
```

---

# Running BITS

BITS is designed to be run on a Ubuntu 16 system and can be run in dev mode as well as in production mode.

### Deployment

Put the BITS directory in `/opt/bits`. Then copy the start script `./bits/support/systemd/bits.service` to `/lib/systemd/system/bits.service`.

run `systemctl enable bits.service`

Then to start BITS run `systemctl start bits`.

### Development

For development you can run BITS by

```bash
npm run dev -- -d <DATA_DIR>
```
The data dir can be any directory and if not specified will default to `./bits/data`

*Note: BITS can be in any directory to run in dev mode*

---

# Running Modules

In a normal production environment modules are installed to `<data>/base/modules/modules` after their packages are uploaded to `<data>/base/modules/modules-packages`. For development it is advised that you add a soft symlink from your module to the data directory.

For example:
```bash
ln -s ~/Projects/bits-modules/test-module data/base/modules/modules
```

This prevents modules from being deleted by unloading  modules. Any module that is in this directory will be loaded by the system.

---

Support
===
To make changes to BITS please submit pull requests via github. For feature requests/bug reporting send an email to artisanalbits@gmail.com

---

# Tutorials

Example modules have been provided as a starting place. These can be found in the BITS repos on the github page, and should be worked in the order below.

1. tutorials-bits-technologies
2. tutorials-helloworld
3. tutorials-message-center
4. tutorials-crud
5. tutorials-router
