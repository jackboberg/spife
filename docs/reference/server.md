# Server Object

```javascript
const routing = require('knork/routing')
const knork = require('knork')
const http = require('http')

knork('example', http.createServer(), routing`
  GET /some/path      exampleView
`({
  exampleView (request, context) {
  }
})).then(knorkServer => {
  knorkServer // <--
})
```

The server returned by `knork()`.

## Table of Contents

* [API](#api)
  * [Types](#types)

    * [Server](#server)

    * [Middleware](#middleware)

      * [MaybeResponse : Promise&lt;Response | undefined, Error?>](#mayberesponse--promiseresponse--undefined-error)

  * [Methods](#methods)

    * [knork(name, http, urls\[, middleware=\[\]\]\[opts={}\]) → Promise&lt;Server>](#knorkname-http-urls-middlewareopts--promiseserver)

      * [options.isExternal](#optionsisexternal)
      * [options.maxBodySize](#optionsmaxbodysize)
      * [options.enableFormParsing](#optionsenableformparsing)
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

#### `knork(name, http, urls[, middleware=[]][opts={}]) → Promise<Server>`

##### `options.isExternal`

##### `options.enableFormParsing`

##### `options.maxBodySize`

##### `options.requestIDHeaders`

##### `options.onclienterror`

#### `Server#closed → Promise<>`

#### `Middleware#install(Server, next) → Promise<>`

#### `Middleware#processRequest(request, context, next) → MaybeResponse`

#### `Middleware#processView(request, match, context, next) → MaybeResponse`
