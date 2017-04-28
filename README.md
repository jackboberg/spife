# :fork_and_knife: Knork :fork_and_knife:

A jshttp-based microframework designed to [help align "doing the right thing"
and "doing the easy thing"][topic-ethos]. Collects and curates the following
packages:

1. **Routing**, courtesy of [`reverse`][reverse],
2. **Database access**, courtesy of [`pg`][pg]
3. **Per-request concurrency and transactions**, courtesy of
   [`pg-db-session`][pg-db-session],
4. An **ORM**, courtesy of [`ormnomnom`][ormnomnom],
5. **Metrics gathering**, courtesy of [`numbat-emitter`][numbat-emitter],
6. **Monitoring**, a la [`restify-monitor`][restify-monitor],
7. and **Logging**, courtesy of [`bole`][bole]

```javascript
'use strict'

const TransactionMiddleware = require('@npm/knork/middleware/transaction')
const DatabaseMiddleware = require('@npm/knork/middleware/database')
const LoggingMiddleware = require('@npm/knork/middleware/logging')
const MetricsMiddleware = require('@npm/knork/middleware/metrics')
const MonitorMiddleware = require('@npm/knork/middleware/monitor')
const CommonMiddleware = require('@npm/knork/middleware/common')
const routing = require('@npm/knork/routing')
const bole = require('@npm/knork/logging')
const knork = require('@npm/knork')

const http = require('http')

bole.output({
  level: 'info',
  stream: process.stdout
})

const urls = routing`
  GET   /               hello
`({
  hello (req) {
    return {message: 'hello world'}
  }
})

const server = http.createServer().listen(8124)
const getServer = knork('user-acl', server, urls, [
  CommonMiddleware(),
  LoggingMiddleware(),
  MetricsMiddleware(),
  MonitorMiddleware(),
  DatabaseMiddleware(),
  TransactionMiddleware()
], {isExternal: false})

getServer.then(knorkServer => {
})
```

## API

Full docs [are available here][docs].

1. If you're just getting started with Knork, you might try the
   [tutorial][getting-started]!
2. You might have some questions. Check the [FAQ][faq].
3. The [topic documentation][topics] lays out the high-level concepts.
4. [Reference documentation][reference] covers API signatures and methods.

-------------------------------------

*:package: denotes a link to an external package that has been bundled
with Knork.*

* Modules
  * [`require('knork') → createServer`][ref-server]
  * **[Middleware][topic-request-lifecycle]**
    * `require('knork/middleware/transaction') → TransactionMiddleware`
    * `require('knork/middleware/database') → DatabaseMiddleware`
    * `require('knork/middleware/monitor') → MonitorMiddleware`
    * `require('knork/middleware/metrics') → MetricsMiddleware`
    * `require('knork/middleware/logging') → LoggingMiddleware`
    * `require('knork/middleware/common') → CommonMiddleware`
  * **HTTP**
    * :package: [`require('knork/routing') → reverse`][reverse]
    * [`require('knork/reply')`][ref-reply]
    * [Incoming Requests][ref-request]
  * **Database**
    * :package: [`require('knork/db/session') → pg-db-session`][pg-db-session]
    * :package: [`require('knork/db/connection') → pg`][pg]
    * :package: [`require('knork/db/orm') → ormnomnom`][ormnomnom]
  * **Sub-packages**
    * :package: [`require('knork/logging') → bole`][bole]
    * :package: [`require('knork/joi') → joi`][joi]
  * **Common Decorators**
    * [`require('knork/decorators/transaction')`][ref-transaction]
    * [`require('knork/decorators/validate')`][ref-validate]
  * **Common Views**
    * [`require('knork/views/paginate')`][ref-view-paginate]
  * **Utilities**
    * [`require('knork/utils/paginate')`][ref-paginate]
    * [`require('knork/utils/rethrow')`][ref-rethrow]

## Development

To develop locally, clone this repository, and run `npm install` in a shell
in the repository directory. From there you can:

* `npm test`: Run both the linter and the code tests.
* `npm run lint`: Run *just* the linter.
* `npm run cov:test`: Run the code tests with code coverage enabled.
* `npm run cov:html`: Run the code tests and output a coverage directory.
  serve the directory at `http://localhost:60888`.

## License

Unlicensed.

[bole]: http://github.com/rvagg/bole
[docs]: ./docs
[getting-started]: ./docs/getting-started.md
[faq]: ./docs/faq.md
[topics]: ./docs/topics
[reference]: ./docs/reference
[joi]: https://github.com/hapijs/joi
[numbat-emitter]: https://github.com/ceejbot/numbat-emitter
[ormnomnom]: https://github.com/chrisdickinson/ormnomnom
[pg-db-session]: https://github.com/npm/pg-db-session
[pg]: https://github.com/brianc/node-postgres
[ref-paginate]: ./docs/reference/utils-paginate.md
[ref-reply]: ./docs/reference/reply.md
[ref-request]: ./docs/reference/request.md
[ref-rethrow]: ./docs/reference/utils-rethrow.md
[ref-server]: ./docs/reference/server.md
[ref-transaction]: ./docs/reference/decorator-transaction.md
[ref-validate]: ./docs/reference/decorator-validate.md
[ref-view-paginate]: ./docs/reference/view-paginate.md
[restify-monitor]: https://github.com/npm/restify-monitor
[reverse]: https://github.com/chrisdickinson/reverse
[topic-ethos]: ./docs/topics/ethos.md
[topic-request-lifecycle]: ./docs/topics/request-lifecycle.md
