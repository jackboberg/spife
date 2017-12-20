'use strict'

module.exports = {sprout}

const once = require('once')

function sprout (list, inner) {
  return list.reduceRight((acc, xs) => {
    return async (...args) => {
      args.push(once(async () => acc(...args.slice(0, -1))))
      return xs(...args)
    }
  }, inner)
}
