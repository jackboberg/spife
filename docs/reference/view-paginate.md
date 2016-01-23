# Pagination View

```javascript
const paginate = require('knork/views/paginate')
```

A function that provides a basic paginated list [view][def-view].

## Table of Contents

### Methods

#### `paginate(req, context, options: Options) → Response`

##### `Options`

* `allowOrdering`: `Boolean`
* `perPage`: `Number`
* `maxPerPage`: `Number`
* `url`: `Function → String`
* `serialize`: `Function → String`
