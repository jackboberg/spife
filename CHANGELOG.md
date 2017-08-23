# Change Log

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

<a name="8.0.0"></a>
# [8.0.0](https://github.com/npm/knork/compare/v3.0.3...v8.0.0) (2017-08-23)


### Bug Fixes

* add 400 status to validation error, do not create new error ([59546eb](https://github.com/npm/knork/commit/59546eb))
* allow insecure csrf cookies in dev mode; regen csrf w/appropriate config ([088e217](https://github.com/npm/knork/commit/088e217))
* default body parser had wrong method signature ([#34](https://github.com/npm/knork/issues/34)) ([3a739bf](https://github.com/npm/knork/commit/3a739bf))
* do not error out if a json response comes back with a ".pipe" member ([5a2c739](https://github.com/npm/knork/commit/5a2c739))
* don't override connection until server bootstraps ([#33](https://github.com/npm/knork/issues/33)) ([4c342e0](https://github.com/npm/knork/commit/4c342e0))
* it helps to use the correct variable names ([bdd6c09](https://github.com/npm/knork/commit/bdd6c09))
* large responses were doing a timewarp ([ed140c6](https://github.com/npm/knork/commit/ed140c6))
* logging middleware should return res ([6987292](https://github.com/npm/knork/commit/6987292))
* make process metrics interval configurable ([20c0f99](https://github.com/npm/knork/commit/20c0f99))
* no longer emit deprecation warnings on test ([57da467](https://github.com/npm/knork/commit/57da467))
* table.default → table.table in show-query-metrics ([3b50a03](https://github.com/npm/knork/commit/3b50a03))
* un-decorate() db.atomic/transaction ([31ab5cb](https://github.com/npm/knork/commit/31ab5cb))
* use [@npm](https://github.com/npm)/decorate for decorators ([893e6bc](https://github.com/npm/knork/commit/893e6bc))
* use variables that exist ([cd02ff1](https://github.com/npm/knork/commit/cd02ff1))
* **csp:** image-src is not a directive ([47d1c90](https://github.com/npm/knork/commit/47d1c90))
* **middleware:** PR fixes for csp ([c8cbfcd](https://github.com/npm/knork/commit/c8cbfcd))


### Features

* add "knork init app" ([d90cb8b](https://github.com/npm/knork/commit/d90cb8b))
* add basic default Loader class ([0a86318](https://github.com/npm/knork/commit/0a86318))
* add litmus option to loader ([5a3cceb](https://github.com/npm/knork/commit/5a3cceb))
* add Server#uninstall(). ([67599f0](https://github.com/npm/knork/commit/67599f0))
* coerce middleware resps between execution ([bcf473a](https://github.com/npm/knork/commit/bcf473a))
* rework middleware ([ae79b07](https://github.com/npm/knork/commit/ae79b07))
* validate.{body,query} now call view on error ([98884ce](https://github.com/npm/knork/commit/98884ce))
* **dep:** add package-lock ([d2b8e82](https://github.com/npm/knork/commit/d2b8e82))
* **middleware:** CSP ([92672db](https://github.com/npm/knork/commit/92672db))
* **processBody:** a new middleware lifetime! ([653c54f](https://github.com/npm/knork/commit/653c54f))
* **test:** add travis badge to readme ([ce2ac59](https://github.com/npm/knork/commit/ce2ac59))


### BREAKING CHANGES

* Middleware cannot return a false-y value, or throw non-Error
values.
* Completely rework how middleware functions in Knork.



<a name="6.0.2"></a>
## [6.0.2](https://github.com/npm/knork/compare/v6.0.1...v6.0.2) (2017-05-19)


### Bug Fixes

* do not error out if a json response comes back with a ".pipe" member ([5a2c739](https://github.com/npm/knork/commit/5a2c739))



<a name="6.0.0"></a>
# [6.0.0](https://github.com/npm/knork/compare/v5.0.5...v6.0.0) (2017-05-18)


### Bug Fixes

* logging middleware should return res ([6987292](https://github.com/npm/knork/commit/6987292))


### Features

* coerce middleware resps between execution ([bcf473a](https://github.com/npm/knork/commit/bcf473a))
* rework middleware ([ae79b07](https://github.com/npm/knork/commit/ae79b07))


### BREAKING CHANGES

* Middleware cannot return a false-y value, or throw non-Error
values.
* Completely rework how middleware functions in Knork.



<a name="5.0.0"></a>
# [5.0.0](https://github.com/npm/knork/compare/v4.0.2...v5.0.0) (2017-04-28)



<a name="3.0.0-beta0"></a>
# [3.0.0-beta0](https://github.com/npm/knork/compare/v2.3.0...v3.0.0-beta0) (2016-12-28)

### dev deps bumps

ecstatic  1.4.0 -> 2.1.0
standard  5.4.1 -> 8.6.0
tap       5.0.1 -> 8.0.1


### major bumps

format-link-header  1.0.0 -> 2.0.0 (using ES6 language features)
numbat-emitter      2.3.2 -> 3.2.1
table               3.8.3 -> 4.0.1 (used by knork test metrics report)
uuid                2.0.1 -> 3.0.1 (removed uuid parsing, which is not used by knork)

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
# [2.3.0](https://github.com/npm/knork/compare/v2.2.9...v2.3.0) (2016-09-02)


### Features

* reply.empty() now accepts optional status code ([#4](https://github.com/npm/knork/issues/4)) ([4a84fd0](https://github.com/npm/knork/commit/4a84fd0))



<a name="2.2.9"></a>
## [2.2.9](https://github.com/npm/knork/compare/v2.2.8...v2.2.9) (2016-07-28)


### Bug Fixes

* we were pulling in the wrong joi ([#3](https://github.com/npm/knork/issues/3)) ([983b27a](https://github.com/npm/knork/commit/983b27a))
