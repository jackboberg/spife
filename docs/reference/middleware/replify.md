# replify Middleware

```javascript
const replifyMiddleware = require('@npm/spife/middleware/replify')
const http = require('http')

spife('example-server', http.createServer().listen(8124), routes`
  GET / index
`({
  index () {
    return reply.replify('foo', {message: 'bar'})
  }
}), [
  replifyMiddleware()
])
```

This will produce a repl at `example-server-${process.pid}`

You can use whichever tooling to access the application that you feel
is right at that point, be it SOCAT, NETCAT, or the repl-client

See options at: https://www.npmjs.com/package/replify
