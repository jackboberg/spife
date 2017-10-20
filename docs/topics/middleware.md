# Middleware

## What is middleware?

Knork middleware is a framework of hooks into the behavior of your application.
Middleware allows you to control your application's startup/shutdown cycle,
request body parsing, and the request/response cycle. For example, if your
server isn't ready until it can establish a connection to postgres, you could
use middleware to delay until it's ready. If you wanted to add a header to
every response from your site, you could use middleware to intercept all
responses.

Middleware components are separated by concern. Knork comes with some useful
middleware. For example, Knork's metrics middleware handles setting up a metrics
emitter and collecting useful request metrics.

## What does middleware look like?

Middleware is defined as a function that returns an object with some well-known
methods:

```javascript
'use strict'

module.exports = function createMiddleware () {
  return {
    processRequest (req, next) {
      return next()
    }
  }
}
```

These methods are known as "lifecycles". There are four lifecycles:

- `processServer`: Covers startup to shutdown.
- `processRequest`: Covers request to response.
- `processView`: Covers view resolution to execution.
- `processBody`: Covers a request for the request body until the parsing of the body.

(We'll cover these in more detail below.)

Middleware is installed in a list in an application's settings:

```javascript
exports.MIDDLEWARE = [
  '@npm/knork/logging',
  './middleware/my-middleware',
  ['./middleware/complex-middleware', {arguments: 'to'}, {the: 'middleware'}]
]
```

Middleware lifecycles work like an onion. Each component is a layer of the
onion. Calling `next()` moves to the next layer and returns a promise. When the
next layer is done, the promise will resolve (or reject, if there was an
error!) The last middleware in the list will call Knork's default behavior for
that particular lifecycle. **If you don't call `next()`**, subsequent
middleware hooks for a particular lifecycle won't fire. This can be handy
behavior: it allows you to return a response from middleware without triggering
other machinery.

So, given middleware `A`, `B`, and `C`:

```
              return          return          return
 in ---> A -- next() --> B -- next() --> C -- next() --> (knork itself)
                 ↑               ↑               ↑        |
out <--- A <---- * <---- B <---- * <---- C <---- * -------+
                 |               |               |
              promise         promise         promise
              resolved at *   resolved at *   resolved at *
```

You can think of `next()` as giving the rest the middleware a chance to run.

## The Lifecycles

Knork provides the following lifecycles. Some lifecycles may not be fired all
of the time!

### `processServer`

`processServer` is always fired. This lifecycle runs when a knork service is
starting up, and resolves when the server is closed **or** when
`knorkServer.uninstall()` is called. In most cases this will be the entire
lifetime of the process. This lifetime is useful for setting up process-wide
resources.

It receives two arguments, `server` (the knork server) and `next` (a function).
`next()` will resolve to `undefined`.

An example `processServer` middleware that installs a redis connection:

```javascript
const redis = require('redis')

module.exports = function createRedisMiddleware ({url} = {}) {
  let redisClient = null
  return {
    processServer (server, next) {
      redisClient = redis.connect(url)
      return next().then(() => {
        redisClient.end({flush: false}) // clean up when the server closes.
      })
    }
  }
}
```

> **Note**: This works very nicely with async/await!
>
> ```javascript
> const redis = require('redis')
> 
> module.exports = function createRedisMiddleware ({url} = {}) {
>   let redisClient = null
>   return {
>     async processServer (server, next) {
>       redisClient = redis.connect(url)
>       await next()
>       redisClient.end({flush: false}) // clean up when the server closes.
>     }
>   }
> }
> ```

### `processRequest`

`processRequest` is fired whenever a request is received, but before the
request is routed to a view. It resolves when a response is returned. It's
useful for adding behavior to your entire application. If you need to attach
clients to the request, this is the place to do it!

`processRequest` receives two arguments: `req` (a [knork request object]) and
`next` (a function). `next` will resolve to a response.

If you return a value directly from `processRequest`, it will be treated as the
response.

For example, here is a simple authorization middleware:

```javascript
const basicAuthParser = require('basic-auth-parser')
const reply = require('@npm/knork/reply')

const INGEN_USERS = new Map([
  ['dennis nedry', 'you didn\'t say the magic word'],
  ['johnhammond', 'we spared no expense']
])

module.exports = function createBasicAuth (users = INGEN_USERS) {
  return {
    processRequest (req, next) {
      if (!req.headers.authorization) { // all req headers are lower-cased
        throw new reply.UnauthorizedError(
          'you will have to wait for jurassic world'
        )
      }

      const {username, password} = basicAuthParser(req.headers.authorization)
      if (users.get(username) !== password) { // see NOTE
        throw new reply.UnauthorizedError(
          'sorry biosyn employee no dinosaurs for you'
        )
      }

      return next() // welcome to jurassic park.
    }
  }
}

// NOTE: in real life, use crypto.timingSafeEqual to compare passwords!
// This is just security for a doomed dinosaur park so it's okay if folks
// hack their way in.
```

### `processView`

`processView` is fired when a view is successfully resolved for a request. If
a request cannot be routed to a view, this lifecycle won't fire! It resolves when
the view has been executed and the resulting promise has been resolved.

`processView` receives four arguments:

- `req`: the knork request object,
- `match`: an object representing the matched route,
- `params`: a `Map` containing the url parameters captured as part of the match,
- and `next`: a function.

`next()` will resolve to a response. If you return a value directly from
`processView`, it will be used as the response.

This lifecycle can be handy for conditionally disabling behaviors that would
otherwise happen universally:

```javascript
module.exports = addTimingHeader

const reply = require('@npm/knork/reply')

function addTimingHeader () {
  return {
    processView (req, match, params, next) {
      if (match.controller[match.name].dontTimeMe) {
        // no timing for this route
        return next()
      }

      const start = Date.now()
      return next().then(res => {
        return reply.header(res, 'x-timing', Date.now() - start)
      })
    }
  }
}

// your view might look like this:
function dontRushMe (req, params) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve('I will reply when I feel like it, and not a moment sooner')
    }, 1000)
  })
}
dontRushMe.dontTimeMe = true
```

### `processBody`

`processBody` fires the first time `req.body` is accessed. It is responsible
for taking the stream of request data and turning it into a plain JS object. It
is resolved once a body middleware returns a value. By default, without any
middleware installed, Knork will throw an `UnsupportedMediaTypeError`.


`processBody` receives three arguments:

- `req`: a Knork request object,
- `stream`: a Readable stream,
- and `next`: a function.

`stream` only exposes the body data from the request -- it is not the raw Node
HTTP request.

For example, you could write a body parser for XML:

```
const getStream = require('get-stream')
const xml = require('xml-parser')

module.exports = function createXMLParserMiddleware ({
  contentType = /^application\/xml$/
} = {}) {
  return {
    parseBody (req, stream, next) {
      if (!contentType.match(req.headers['content-type'])) {
        return next() // we can't handle this content type!
      }

      return getStream(stream).then(str => {
        return xml(str)
      })
    }
  }
}
```

[knork request object]: ../ref/request.md
