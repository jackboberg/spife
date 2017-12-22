'use strict'

const decorate = require('@npm/decorate')

module.exports = (...decorators) => (viewFn) => {
  return decorators.reduceRight((acc, xs) => {
    return decorate(acc, xs(acc))
  }, viewFn)
}
