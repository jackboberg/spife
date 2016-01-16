'use strict'

module.exports = {
  body: validateBody,
  query: validateQuery
}

const http = require('../http')
const joi = require('joi')

function validateBody (schema, view) {
  return inner

  function inner (req, context) {
    const args = Array.from(arguments)
    return req.body.then(body => {
      const result = joi.validate(body, schema)
      if (result.error) {
        throw new http.BadRequestError(result.error)
      }
      req.validatedBody = Promise.resolve(result.value)
      return view.apply(this, args)
    })
  }
}

function validateQuery (schema, view) {
  return inner

  function inner (req, context) {
    const args = Array.from(arguments)
    const result = joi.validate(req.query, schema)
    if (result.error) {
      throw new http.BadRequestError(result.error)
    }
    req.validatedQuery = result.value
    return view.apply(this, args)
  }
}
