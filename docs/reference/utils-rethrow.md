# Rethrow

```javascript
const rethrow = require('knork/utils/rethrow')

module.exports = function myView (req, context) {
  return Blog.objects.get({id: context.get('id')})
    .catch(Blog.objects.NotFound, rethrow(404))
}
```

`rethrow` creates a function that will decorate any error with provided header
and status information and rethrow it. Useful for adding HTTP semantics to an
existing `Error` object.
