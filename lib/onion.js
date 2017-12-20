'use strict'

module.exports = Object.assign(onion, {sprout})

const once = require('once')

function sprout (list, inner) {
  return list.reduceRight((acc, xs) => {
    return async (...args) => {
      args.push(once(async () => acc(...args.slice(0, -1))))
      return xs(...args)
    }
  }, inner)
}

function onion (mw, each, after, inner, ...args) {
  let idx = 0
  const argIdx = args.push(null) - 1

  return sprout(mw.reduce((acc, xs) => {
    acc.push((...args) => each(xs, ...args))
    acc.push(async (...args) => {
      try {
        return after.resolve(args[args.length - 1]())
      } catch(err) {
        throw after.reject(err)
      }
    })
    return acc
  }, []), inner)(...args)

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
