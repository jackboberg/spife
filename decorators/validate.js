'use strict'

module.exports = {
  body: validateBody,
  query: validateQuery
}

const decorate = require('@npm/decorate')
const Promise = require('bluebird')
const reply = require('../reply')
const joi = require('../joi')

function validateBody (schema, view) {
  bodyValidator.schema = schema
  return decorate(view, bodyValidator)

  function bodyValidator (req, context) {
    const args = Array.from(arguments)
    return req.body.then(body => {
      const result = joi.validate(body, schema)
      if (result.error) {
        req.validatedBody = Promise.reject(new reply.BadRequestError(result.error))
        req.validatedBody.catch(() => {}) // this will be handled later, by the view.
      } else {
        req.validatedBody = Promise.resolve(result.value)
      }
      return view.apply(this, args)
    })
  }
}

function validateQuery (schema, view) {
  queryValidator.schema = schema
  return decorate(view, queryValidator)

  function queryValidator (req, context) {
    const args = Array.from(arguments)
    const result = joi.validate(req.query, schema)
    if (result.error) {
      req.validatedQuery = Promise.reject(new reply.BadRequestError(result.error))
      req.validatedQuery.catch(() => {}) // handled later, by the view.
    } else {
      req.validatedQuery = result.value
    }
    return view.apply(this, args)
  }
}
