'use strict'

/* eslint-disable node/no-deprecated-api */
const domain = require('domain')
/* eslint-enable node/no-deprecated-api */

const DOMAIN_TO_REQUEST = new WeakMap()

const enter = domain.Domain.prototype.enter

domain.Domain.prototype.enter = function () {
  const prior = process.domain
  if (prior) {
    DOMAIN_TO_REQUEST.set(this, DOMAIN_TO_REQUEST.get(prior))
  }
  return enter.apply(this, arguments)
}

module.exports = {
  get request () {
    return DOMAIN_TO_REQUEST.get(process.domain)
  },
  set request (req) {
    DOMAIN_TO_REQUEST.set(process.domain, req)
  }
}
