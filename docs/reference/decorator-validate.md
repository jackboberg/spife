# Validation Decorators

```javascript
const validate = require('spife/decorators/validate')
```

Contains [view][def-view] decorators that handle request input validation.

## Table of Contents

* [API](#api)
  * [Methods](#methods)

    * [validate.body(schema: Joi, viewFn: Function) → Function](#validatebodyschema-joi-viewfn-function--function)
    * [validate.query(schema: Joi, viewFn: Function) → Function](#validatequeryschema-joi-viewfn-function--function)

## API

### Methods

#### `validate.body(schema: Joi, viewFn: Function) → Function`

Given a `schema` and `viewFn`, return a function that applies validation to the
incoming request body based on `schema` before executing `viewFn`.

The result of validation will be made available on the [request][def-request]
object as `validatedBody`.

`validatedBody` is a `Promise` which may resolve to an object **OR** reject
with a validation error. Rejections will be automatically given a status of
`400 Bad Request`.

```javascript
'use strict'

const validate = require('@npm/spife/decorators/validate')
const routes = require('@npm/spife/routing')
const reply = require('@npm/spife/reply')
const joi = require('@npm/spife/joi')
const spife = require('@npm/spife')

spife(routes`
  POST /update update
`({
  update: validate.body(joi.object({
    uuid: joi.string().guid()
  }), update)
}))

async function update (req, context) {
  try {
    const {uuid} = await req.validatedBody
    return 'ok, great!'
  } catch (err) {
    console.log(reply.status(err)) // 400
    throw err
  }
}
```

It is possible to examine the passed schema using `require('@npm/spife/utils/decorate')`:

```
const validate = require('@npm/spife/decorators/validate')
const {decorations} = require('@npm/spife/utils/decorate')

const update = validate.body(joi.object({
  uuid: joi.string().guid()
}), (req, context) => {})

console.log([...decorations(update)][0].schema)
```

> :warning: **`validate.body` consumes all incoming request body data.**
>
> If a view is wrapped in `validate.body`, the underlying
> [`IncomingMessage`][def-incomingmessage] stream represented by `req.raw` will
> be consumed until exhaustion.

> :warning: **`validate.body` cannot be used with `req.raw`.**
>
> If other decorators or middleware access `req.raw` before the wrapped view
> executes, this view will automatically reject with an `Error` noting that
> the body cannot be consumed.

#### `validate.query(schema: Joi, viewFn: Function) → Function`

Similar to `validate.body`, `validate.query` takes a schema and view function
and returns a view fucntion that applies validatoin to the incoming request
query parameters.

The result of this validation will be made available on the
[request][def-request] object as `validatedQuery`.

`validatedQuery` is a `Promise` which may resolve to an object **OR** reject
with a validation error. Rejections will be automatically given a status of
`400 Bad Request`.

```javascript
'use strict'

const validate = require('@npm/spife/decorators/validate')
const routes = require('@npm/spife/routing')
const reply = require('@npm/spife/reply')
const joi = require('@npm/spife/joi')
const spife = require('@npm/spife')

spife(routes`
  GET /list list
`({
  list: validate.query(joi.object({
    page: joi.number().integer().min(0).default(0)
  }), list)
}))

async function list (req, context) {
  try {
    const {page} = await req.validatedQuery
    return `grabbing page ${page}!`
  } catch (err) {
    console.log(reply.status(err)) // 400
    throw err
  }
}
```

It is possible to examine the passed schema using `require('@npm/spife/utils/decorate')`:

```
const validate = require('@npm/spife/decorators/validate')
const {decorations} = require('@npm/spife/utils/decorate')

const list = validate.query(joi.object({
  page: joi.number().integer().min(0).default(0)
}), (req, context) => {})

console.log([...decorations(list)][0].schema)
```

[def-view]: ../topics/views.md
[def-request]: ./request.md
[def-incomingmessage]: https://nodejs.org/api/http.html#http_class_http_incomingmessage
