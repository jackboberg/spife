# Pagination View

```javascript
const paginate = require('knork/views/paginate')
```

A function that provides a basic paginated list [view][def-view].

## Table of Contents

* [API](#api)
  * [Methods](#methods)

    * [paginate(req, context, options: Options) → Response](#paginatereq-context-options-options--response)

      * [Options](#options)

## API

### Methods

#### `paginate(req, context, options: Options) → Response`

##### `Options`

* `allowOrdering`: `Boolean`
* `perPage`: `Number`
* `maxPerPage`: `Number`
* `url`: `Function → String`
* `serialize`: `Function → String`
