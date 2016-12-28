# Change Log

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

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
