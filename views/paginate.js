'use strict'

const querystring = require('querystring')
const Promise = require('bluebird')
const joi = require('../joi')

const validate = require('../decorators/validate')
const paginate = require('../utils/paginate')
const rethrow = require('../utils/rethrow')

module.exports = validate.query(joi.object({
  perPage: joi.number().integer().min(0).default(10),
  page: joi.number().integer().min(0).default(0),
  order: joi.string()
}).unknown(), list)

function list (req, context, opts) {
  opts = Object.assign({
    serialize (xs) { return xs }
  }, opts || {})
  var qs = opts.queryset
  if (opts.allowOrdering !== false && req.validatedQuery.order) {
    qs = qs.order(req.validatedQuery.order)
  }
  const paginator = paginate(
    qs,
    Math.min(
      req.validatedQuery.perPage || Number(opts.perPage) || 10,
      opts.maxPerPage || 9999
    )
  )
  const getPage = paginator.page(req.validatedQuery.page)
  return getPage.then(page => {
    const urls = {}
    if (page.hasNext) {
      urls.next = opts.url(querystring.stringify(Object.assign(
        {},
        req.query,
        {page: page.next}
      )))
    }
    if (page.hasPrev) {
      urls.prev = opts.url(querystring.stringify(Object.assign(
        {},
        req.query,
        {page: page.prev}
      )))
    }
    return Promise.props({
      objects: Promise.all(page.objects.map(xs => opts.serialize(xs))),
      total: page.total,
      urls
    })
  }).catch(paginate.OutOfRange, rethrow(404))
    .catch(paginate.InvalidPage, rethrow(400))
}
