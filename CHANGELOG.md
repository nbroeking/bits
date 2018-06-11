<a name="2.20.0"></a>
# 2.20.0 (2018-05-29)


### Bug Fixes

* **browser:** Check that object is defined before accessing properties   (eb4df49)
* add null checks for process members   (7a158a2), closes BITS-115
* **upgrade:** Ensure file removal is complete   (b720071), closes BITS-117
* **upgrade:** Moving directory vs directory contents, delete modules   (96f3b33)
* **upgrade:** Removes mini-message-center and base-load-url   (adf6d31)
* **upgrade_rmrf:** Fix rm -rf to use spawn   (ce8f4f0)
* Client reload on upgrade start event and socket null   (3e0fc82)
* fix keys and values call for Persistent KV   (39f8d9f)
* fix merge conflict resolution that copied wrong line   (c4e081c), closes BITS-109 BITS-117
* Module count should be based on the extracted dir   (04d2f51)


### Features

* add utility method for mkdirp   (81a847c)
* add utility method for mkdirp   (a7af61a)
* add which to util-fs   (313f9ba)
* Moved node module requires specific load methods   (8959298)
* **upgrade:** Show upgrade errors in the OMGs UI   (5b165ba), closes BITS-109 BITS-110 BITS-111 BITS-112 BITS-113
* **upgrade-server:** Initial commit of Upgrade Server   (fe235c6), closes BITS-93 BITS-94 BITS-95
* remove the username from the bottom and always display it in toolbar   (ec4f555), closes BITS-27

---

<a name="2.19.0"></a>
# 2.19.0 (2018-03-26)


### Bug Fixes

* **browser:** fix behavior context   (35e9f47)
* **browser:** fix behavior context   (812b007)
* **browser:** Missing shared style import   (d545151), closes BITS-100
* **modules:** bits base shows loaded   (37c1770), closes BITS-88
* **var-name:** send correct result   (12eb3bf)
* **var-name:** send correct result   (b83f2ad)


### Features

* **browser:** implement base-layout   (326004e)
* **browser:** shared styles and behavior   (0e99583)
* **browser:** style override   (117c80a)
* **crud-router:** add crud-router base class with setup via crud-manager   (ddd1de1), closes BITS-89
* **crud-router:** add crud-router base class with setup via crud-manager   (4f7c549), closes BITS-89
* **crud-router:** add crud-router base class with setup via crud-manager   (136b620), closes BITS-89
* can remove sensors   (b7278e9)
* loading base will reject if something goes wrong   (56bdfb1)


### Reverts

* **browser): revert refactor(browser:** remove unused props   (bf4376d)

---

<a name="2.18.0"></a>
# 2.18.0 (2018-02-28)


### Features

* **server:** disable setTime request handler   (0918eba), closes BITS-98

---

<a name="2.17.2"></a>
## 2.17.2 (2018-02-21)


### Bug Fixes

* fixes issue where module crashes during load   (6914af6), closes BITS-79
* **browser:** getDistributedNodes deprecated in Firefox Quantum   (eb17ad6)

---

<a name="2.17.1"></a>
## 2.17.1 (2018-02-12)


### Bug Fixes

* **browser:** vaadin-grid-sorter order   (e1b1265)

---

<a name="2.17.0"></a>
# 2.17.0 (2018-02-01)


### Bug Fixes

* backend list gets all data for users   (88ad29d)


### Features

* added ability to manually add a proxy path   (8bbaece)

---

<a name="2.16.0"></a>
# 2.16.0 (2018-01-12)


### Bug Fixes

* fix ReferenceError that results from an uncaughtException   (25d44c0)
* make stdout/stderr available on non-0 exit code   (3f1d92c)


### Features

* **client:** Vaadin Grid column behavior.   (8cf0d0d)
* add bits-crypto module   (e28abd5)
* add santize item to pouch operations   (030884e)
* **manager-state-listener:** add manager state changed listener to module-api   (fea575d)
* Adds column width and default setting of widths   (1538168)
* use Decrypter to decrypt files   (3de8b85)
* use Encrypter to encrypt   (ca405ac)

---

<a name="2.15.0"></a>
# 2.15.0 (2018-01-04)


### Bug Fixes

* **chain-failure:** prevent one failed operation from ruining it for the rest   (9182aaf), closes BITS-73
* **clear-activities:** fix dismiss all button not working   (9814ecf), closes BITS-73


### Features

* allow BaseServer helper to start web server on any port   (4575082)

---

<a name="2.14.0"></a>
# 2.14.0 (2017-11-29)


### Bug Fixes

* **activity-creation:** chain creation of activities to avoid creating in the same millisecond   (3bcc22f)
* **client:** add month and day to activity timestamp   (cdd01a5)
* **client:** handle no displayName and sort ignoring case   (e17adb6)
* **client:** sort by display name   (0df112f)
* **daemon:** add kill method to daemon helper   (536a143)
* **remove-listeners:** fix method signature and logic to handle scopes being passed in   (d30585c), closes BITS-65
* **remove-middleware:** fix issue with removing middleware   (2fbf5db), closes BITS-64
* **server:** report module installation path   (0df9612)


### Features

* create promise-ified exec() from child-process   (433cce2)

---

<a name="2.13.0"></a>
# 2.13.0 (2017-11-11)


### Bug Fixes

* allow modules to subscribe to event listeners   (51ab538)
* Long titles will be capped with an ellipsis to make room for sibling elements.   (fe1b315)
* **client:** sort modules alphabetically   (af46cd3), closes BITS-62
* **server:** fix user id for proxy request   (a77ab7f), closes BITS-60


### Features

* **backend:** add PouchDB crud manager   (54eebf5)
* **polymer-element:** Adds new base-moment element   (d0d97cc)

---

<a name="2.12.0"></a>
# 2.12.0 (2017-10-27)


### Bug Fixes

* **backend:** Add PersistentKeyValue helpers   (3078c2c)
* **backend:** Allow omgs with no version string   (7be425c), closes BITS-51
* **backend:** async sanitize activities database   (710e68c), closes BITS-50
* **backend:** Return null instead of module info from unloadModule   (910a3b7), closes BITS-52
* **crud:** fix missing CRUD updates   (b724b07), closes BITS-47
* **test:** Remove unused tests and fixtures   (e36fb41), closes BITS-56
* **ui:** add path to BaseDynamicElements   (233605d)
* fix isBaseAllowed test logic   (a7a6ccf), closes bits-59
* make the BITS id generator portable to systems without hostname command   (26b0f91), closes #19
* **vaadin-multi-select-behavior:** notify changes to hasSelectedItems   (91aa76a)
* notify user on no public key when generating crash dump   (516df3d)


### Features

* **backend:** Add persistent key-value storage   (425575b)
* **frontend:** Add settings for activity limit   (c6f6432)

---

<a name="2.11.0"></a>
# 2.11.0 (2017-10-12)


### Bug Fixes

* **omgs-manager:** allow OMGs to upgrade/downgrade as long as new base version is not 1.x.y   (3c24b3c), closes BITS-49


### Features

* made base-lazy-element safe when page is an empty object   (4090e7c), closes #21

---

<a name="2.10.1"></a>
## 2.10.1 (2017-10-11)


### Bug Fixes

* fix daemon helper cleanup   (ab32239)
* fix unload not passing message center   (9b603a3)
* **$modules:** fix module loading to support release candidates   (ec26293)
* **crud:** fix missing CRUD updates   (e4a5ce2), closes BITS-47
* **crud:** fix some missed emit calls to use arrays   (5ccd131), closes BITS-47

---

<a name="2.10.1"></a>
## 2.10.1 (2017-10-11)


### Bug Fixes

* fix daemon helper cleanup   (ab32239)
* fix unload not passing message center   (9b603a3)
* **$modules:** fix module loading to support release candidates   (ec26293)
* **crud:** fix missing CRUD updates   (e4a5ce2), closes BITS-47
* **crud:** fix some missed emit calls to use arrays   (5ccd131), closes BITS-47

---

<a name="2.10.0"></a>
#
2.10.0 (2017-10-04)


### Bug Fixes

* **build:** Use the new build pre package step   (9d8b23b)


### Features

* **$browser:** adds helper class to browser to aid dynaimc element lists   (71c06fa)

