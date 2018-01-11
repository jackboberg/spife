# Server Object

```javascript
const routing = require('spife/routing')
const spife = require('spife')
const http = require('http')

spife('example', http.createServer(), routing`
  GET /some/path      exampleView
`({
  exampleView (request, context) {
  }
})).then(spifeServer => {
  spifeServer // <--
})
```

The server returned by `spife()`.

## Table of Contents

* [API](#api)
  * [Types](#types)

    * [Server](#server)

    * [Middleware](#middleware)

      * [MaybeResponse : Promise&lt;Response | undefined, Error?>](#mayberesponse--promiseresponse--undefined-error)

  * [Methods](#methods)

    * [spife(name, http, router\[, middleware=\[\]\]\[opts={}\]) → Promise&lt;Server>](#spifename-http-router-middlewareopts--promiseserver)

      * [options.isExternal](#optionsisexternal)
      * [options.requestIDHeaders](#optionsrequestidheaders)
      * [options.onclienterror](#optionsonclienterror)

    * [Server#closed → Promise&lt;>](#serverclosed--promise)

    * [Middleware#processServer(Server, next) → Promise&lt;>](#middlewareinstallserver-next--promise)

    * [Middleware#processRequest(request, next) → MaybeResponse](#middlewareprocessrequestrequest-next--mayberesponse)

    * [Middleware#processView(request, match, context, next) → MaybeResponse](#middlewareprocessviewrequest-match-context-next--mayberesponse)

## API

### Types

#### `Server`

#### `Middleware`

##### `MaybeResponse : Promise<Response | undefined, Error?>`

### Methods

#### `spife(name, http, router[, middleware=[]][opts={}]) → Promise<Server>`

##### `options.isExternal`

##### `options.requestIDHeaders`

##### `options.onclienterror`

#### `Server#uninstall → Promise<>`

Uninstall the Spife router and middleware from the server. Returns a promise that resolves
once the `processServer` middleware has completed.

#### `Server#closed → Promise<>`

#### `Middleware#install(Server, next) → Promise<>`

#### `Middleware#processRequest(request, context, next) → MaybeResponse`

#### `Middleware#processView(request, match, context, next) → MaybeResponse`
