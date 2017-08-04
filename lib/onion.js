'use strict'

module.exports = onion

const Promise = require('bluebird')
const once = require('once')

function onion (mw, each, after, inner, ...args) {
  let idx = 0
  const argIdx = args.push(null) - 1

  return new Promise((resolve, reject) => {
    iter().then(resolve, reject)
  })

  function iter () {
    const middleware = mw[idx]
    if (!middleware) {
      return Promise.try(() => inner(...args)).then(
        after.resolve,
        after.reject
      )
    }

    idx += 1
    args[argIdx] = once(() => {
      return Promise.try(() => iter())
    })
    return Promise.try(() => each(middleware, ...args)).then(
      after.resolve,
      after.reject
    )
  }
}
