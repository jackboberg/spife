'use strict'

const decorate = require('@npm/decorate')
const Promise = require('bluebird')
const reply = require('../reply')
const joi = require('../joi')

const validateBody = (schema) => (viewFn) => {
  return decorate(viewFn, innerFn)

  function innerFn (req, context) {
    if (typeof req.validatedBody !== 'undefined') {
      return viewFn(req, context)
    }

    req.validatedBody = req.body.then((body) => {
      const result = joi.validate(body, schema)

      if (result.error) {
        return Promise.reject(reply.status(result.error, 400))
      }

      return Promise.resolve(result.value)
    })

    return viewFn(req, context)
  }
}

function validateQuery (schema, view) {
  queryValidator.schema = schema
  return decorate(view, queryValidator)

  function queryValidator (req, context) {
    const args = Array.from(arguments)
    const result = joi.validate(req.query, schema)
    if (result.error) {
      req.validatedQuery = Promise.reject(reply.status(result.error, 400))
      req.validatedQuery.catch(() => {}) // handled later, by the view.
    } else {
      req.validatedQuery = result.value
    }
    return view.apply(this, args)
  }
}

module.exports = {
  body: validateBody,
  query: validateQuery
}
