'use strict'

const decorate = require('@npm/decorate')
const Promise = require('bluebird')
const reply = require('../reply')
const joi = require('../joi')

const validateBody = (validator) => (viewFn) => {
  return decorate(viewFn, innerFn)

  function innerFn (req, context) {
    const schema =
      typeof validator === 'function'
        ? createValidator(validator)
        : validator

    req.validatedBody = req.body.then((body) => {
      const result = schema.validate(body)

      if (result.error) {
        throw reply.status(result.error, 400)
      }

      return result.value
    })
    req.validatedBody.catch(() => {})

    return viewFn(req, context)
  }
}

function createValidator (validator) {
  return {
    validator: validator,
    validate (value) {
      try {
        return {value: this.validator(value)}
      } catch (err) {
        return {error: err}
      }
    }
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
