# Change Log

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

<a name="10.0.0"></a>
# [10.0.0](https://github.com/npm/spife/compare/v9.1.0...v10.0.0) (2017-12-28)


### Features

* **hot-reload:** hot reload views, routes, and mw ([da70d60](https://github.com/npm/spife/commit/da70d60))


### Performance Improvements

* request changes ([775f61b](https://github.com/npm/spife/commit/775f61b))


### BREAKING CHANGES

* node 6 is unsupported
* `req.metric` was removed.
* Middleware can no longer be provided as a single function.
* Update your middleware! next() now requires arguments to be
passed to it. (e.g., in `processRequest(req, next)`, one should call
`next(req)`).



<a name="9.0.0"></a>
# [9.0.0](https://github.com/npm/spife/compare/v8.5.0...v9.0.0) (2017-11-27)


### Bug Fixes

* **dep:** set ormnomnom at version that doesn't break node 6 ([17a37ca](https://github.com/npm/spife/commit/17a37ca))
* **versions:** test on 8 & 9 ([d1070bb](https://github.com/npm/spife/commit/d1070bb))
* Release rewritten body validator decorator ([9c752a2](https://github.com/npm/spife/commit/9c752a2))


### Features

* Rewritten validate body decorator ([5d1c4a1](https://github.com/npm/spife/commit/5d1c4a1))
* Rewritten validate body decorator ([085d622](https://github.com/npm/spife/commit/085d622))
* Rewritten validate body decorator ([3859bdb](https://github.com/npm/spife/commit/3859bdb))
* Rewritten validate body decorator ([1c486a3](https://github.com/npm/spife/commit/1c486a3))


### BREAKING CHANGES

* Changes to the validate.body decorator signature



<a name="8.4.1"></a>
## [8.4.1](https://github.com/npm/spife/compare/v8.4.0...v8.4.1) (2017-10-20)


### Bug Fixes

* yargs exits now if parse is run with no second argument ([#44](https://github.com/npm/spife/issues/44)) ([3bb0c5f](https://github.com/npm/spife/commit/3bb0c5f))



<a name="8.0.0"></a>
# [8.0.0](https://github.com/npm/spife/compare/v3.0.3...v8.0.0) (2017-08-23)


### Bug Fixes

* add 400 status to validation error, do not create new error ([59546eb](https://github.com/npm/spife/commit/59546eb))
* allow insecure csrf cookies in dev mode; regen csrf w/appropriate config ([088e217](https://github.com/npm/spife/commit/088e217))
* default body parser had wrong method signature ([#34](https://github.com/npm/spife/issues/34)) ([3a739bf](https://github.com/npm/spife/commit/3a739bf))
* do not error out if a json response comes back with a ".pipe" member ([5a2c739](https://github.com/npm/spife/commit/5a2c739))
* don't override connection until server bootstraps ([#33](https://github.com/npm/spife/issues/33)) ([4c342e0](https://github.com/npm/spife/commit/4c342e0))
* it helps to use the correct variable names ([bdd6c09](https://github.com/npm/spife/commit/bdd6c09))
* large responses were doing a timewarp ([ed140c6](https://github.com/npm/spife/commit/ed140c6))
* logging middleware should return res ([6987292](https://github.com/npm/spife/commit/6987292))
* make process metrics interval configurable ([20c0f99](https://github.com/npm/spife/commit/20c0f99))
* no longer emit deprecation warnings on test ([57da467](https://github.com/npm/spife/commit/57da467))
* table.default → table.table in show-query-metrics ([3b50a03](https://github.com/npm/spife/commit/3b50a03))
* un-decorate() db.atomic/transaction ([31ab5cb](https://github.com/npm/spife/commit/31ab5cb))
* use [@npm](https://github.com/npm)/decorate for decorators ([893e6bc](https://github.com/npm/spife/commit/893e6bc))
* use variables that exist ([cd02ff1](https://github.com/npm/spife/commit/cd02ff1))
* **csp:** image-src is not a directive ([47d1c90](https://github.com/npm/spife/commit/47d1c90))
* **middleware:** PR fixes for csp ([c8cbfcd](https://github.com/npm/spife/commit/c8cbfcd))


### Features

* add "spife init app" ([d90cb8b](https://github.com/npm/spife/commit/d90cb8b))
* add basic default Loader class ([0a86318](https://github.com/npm/spife/commit/0a86318))
* add litmus option to loader ([5a3cceb](https://github.com/npm/spife/commit/5a3cceb))
* add Server#uninstall(). ([67599f0](https://github.com/npm/spife/commit/67599f0))
* coerce middleware resps between execution ([bcf473a](https://github.com/npm/spife/commit/bcf473a))
* rework middleware ([ae79b07](https://github.com/npm/spife/commit/ae79b07))
* validate.{body,query} now call view on error ([98884ce](https://github.com/npm/spife/commit/98884ce))
* **dep:** add package-lock ([d2b8e82](https://github.com/npm/spife/commit/d2b8e82))
* **middleware:** CSP ([92672db](https://github.com/npm/spife/commit/92672db))
* **processBody:** a new middleware lifetime! ([653c54f](https://github.com/npm/spife/commit/653c54f))
* **test:** add travis badge to readme ([ce2ac59](https://github.com/npm/spife/commit/ce2ac59))


### BREAKING CHANGES

* Middleware cannot return a false-y value, or throw non-Error
values.
* Completely rework how middleware functions in Spife.



<a name="6.0.2"></a>
## [6.0.2](https://github.com/npm/spife/compare/v6.0.1...v6.0.2) (2017-05-19)


### Bug Fixes

* do not error out if a json response comes back with a ".pipe" member ([5a2c739](https://github.com/npm/spife/commit/5a2c739))



<a name="6.0.0"></a>
# [6.0.0](https://github.com/npm/spife/compare/v5.0.5...v6.0.0) (2017-05-18)


### Bug Fixes

* logging middleware should return res ([6987292](https://github.com/npm/spife/commit/6987292))


### Features

* coerce middleware resps between execution ([bcf473a](https://github.com/npm/spife/commit/bcf473a))
* rework middleware ([ae79b07](https://github.com/npm/spife/commit/ae79b07))


### BREAKING CHANGES

* Middleware cannot return a false-y value, or throw non-Error
values.
* Completely rework how middleware functions in Spife.



<a name="5.0.0"></a>
# [5.0.0](https://github.com/npm/spife/compare/v4.0.2...v5.0.0) (2017-04-28)



<a name="3.0.0-beta0"></a>
# [3.0.0-beta0](https://github.com/npm/spife/compare/v2.3.0...v3.0.0-beta0) (2016-12-28)

### dev deps bumps

ecstatic  1.4.0 -> 2.1.0
standard  5.4.1 -> 8.6.0
tap       5.0.1 -> 8.0.1


### major bumps

format-link-header  1.0.0 -> 2.0.0 (using ES6 language features)
numbat-emitter      2.3.2 -> 3.2.1
table               3.8.3 -> 4.0.1 (used by spife test metrics report)
uuid                2.0.1 -> 3.0.1 (removed uuid parsing, which is not used by spife)

### upgrades

numbat-process      2.0.7 -> 2.1.0
accepts             1.3.0 -> 1.3.3
bluebird            3.1.1 -> 3.4.7
ormnomnom           2.6.0 -> 2.7.0
percentile          1.1.0 -> 1.2.0
range-parser        1.0.3 -> 1.2.0
statuses            1.2.1 -> 1.3.1

----------------

<a name="2.3.0"></a>
# [2.3.0](https://github.com/npm/spife/compare/v2.2.9...v2.3.0) (2016-09-02)


### Features

* reply.empty() now accepts optional status code ([#4](https://github.com/npm/spife/issues/4)) ([4a84fd0](https://github.com/npm/spife/commit/4a84fd0))



<a name="2.2.9"></a>
## [2.2.9](https://github.com/npm/spife/compare/v2.2.8...v2.2.9) (2016-07-28)


### Bug Fixes

* we were pulling in the wrong joi ([#3](https://github.com/npm/spife/issues/3)) ([983b27a](https://github.com/npm/spife/commit/983b27a))
