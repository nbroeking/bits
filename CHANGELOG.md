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

