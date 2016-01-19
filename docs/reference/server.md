# Knork Server

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

## API

### Types

#### `Server`

#### `Middleware`

##### `MaybeResponse : Promise<Response | undefined, Error?>`

### Methods

#### `knork(name, http, urls[, middleware=[]][opts={}]) → Promise<Server>`

##### `options.isExternal`

##### `options.maxBodySize`

##### `options.requestIDHeaders` 

#### `Middleware#install(Server) → Promise<>`

#### `Middleware#onServerClose(Server) → Promise<>`

#### `Middleware#processRequest(request, context) → MaybeResponse`

#### `Middleware#processView(request, match, context) → MaybeResponse`

#### `Middleware#processResponse(request, response) → MaybeResponse`

#### `Middleware#processError(request, err) → MaybeResponse`
