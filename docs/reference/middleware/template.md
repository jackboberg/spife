# Template Middleware

```javascript
const TemplateMiddleware = require('@npm/knork/middleware/template')
const reply = require('@npm/knork/reply')
const http = require('http')

knork('example-server', http.createServer().listen(8124), routes`
  GET / index
`({
  index () {
    return reply.template('foo', {message: 'bar'})
  }
}), [
  TemplateMiddleware([{
    get (key) {
      if (key === 'foo') {
        return context => `hello ${message}`
      }
    }
  }])
])
```

## Types

### TemplateMiddleware

### Loader

### ContextProcessor
