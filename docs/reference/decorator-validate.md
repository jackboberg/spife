# Validation Decorators

```javascript
const validate = require('knork/decorators/validation')
```

Contains [view][def-view] decorators that automatically handle request
input validation.

## Table of Contents

* [API](#api)
  * [Methods](#methods)

    * [validate.body(Joi, Function) → (Function → Promise)](#validatebodyjoi-function--function--promise)
    * [validate.query(Joi, Function) → (Function → Promise)](#validatequeryjoi-function--function--promise)

## API

### Methods

#### `validate.body(Joi, Function) → (Function → Promise)`

#### `validate.query(Joi, Function) → (Function → Promise)`

[def-view]: ../topics/views.md
