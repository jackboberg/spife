# CSP Middleware

The CSP Middleware sets your [Content-Security-Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP) header to your liking based on
the settings you pass it.

It has default values of:

```
connect-src: `'self'`
default-src: `'none'`
image-src: `'self'`
script-src: `'self'`
style-src: `'self'`
```

which are quite restrictive.

You add a rule to the CSP header by adding a directive and its source list as arguments when
setting up the Middleware. You can pass either a string or an array. If you add a keyword, such
as 'self', 'none', 'unsafe-eval', or 'unsafe-inline', they will be properly escaped in the header.

Example:

```javascript
const CspMiddleware = require('@npm/spife/middleware/csp')
const reply = require('@npm/spife/reply')
const http = require('http')

spife('example-server', http.createServer().listen(8124), routes`
  GET / index
`({
  index () {
    return reply.template('foo', {message: 'bar'})
  }
}), [
  CspMiddleware({
    'connect-src': [
      'self',
      'https://typeahead.npmjs.com/',
      'https://partners.npmjs.com/',
      'https://checkout.stripe.com/api/outer/manhattan',
      'https://api.github.com',
      'https://ac.cnstrc.com',
      'https://*.log.optimizely.com'
    ],
    'default-src': '*',
    'frame-ancestors': 'none',
    'img-src': ['*', 'data:'],
    'script-src': ['*', 'unsafe-eval', 'unsafe-inline', 'safari-extension:'],
    'style-src': ['*', 'unsafe-inline'],
    'report-uri': '/-/csplog'
  }, options)
])
```
