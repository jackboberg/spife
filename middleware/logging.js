'use strict'

module.exports = createLoggingMiddleware

const bole = require('../logging')
const bistre = require('bistre')

const DOMAIN_TO_LOGGER = new WeakMap()

function createLoggingMiddleware (opts, patchObject) {
  patchObject = patchObject || console
  patch(patchObject)

  opts = Object.assign({
    level: 'info',
    stream: null
  }, opts || {})

  if (opts.stream === null) {
    const pretty = bistre()
    opts.stream = (
      process.env.TAP || (
        process.env.ENVIRONMENT !== 'production' &&
        process.env.ENVIRONMENT !== 'staging'
      )
    ) ? (pretty.pipe(process.stdout), pretty) : process.stdout
  }

  bole.output(opts)

  return {
    install (knork) {
      this.name = knork.name
    },
    processRequest (req) {
      if (process.domain) {
        DOMAIN_TO_LOGGER.set(process.domain, bole(`${this.name}:${req.id}`))
      }
      req._logRaw()
    },
    processView (req, match, context) {
      // XXX(chrisdickinson): This is a bit of a hack, since the
      // TransactionMiddleware may have swapped domains on us. What
      // we'd really want here is to use AsyncWrap, but I'm not quite
      // ready to lean heavily on that, yet.
      const oldRunFunction = match.execute
      match.execute = () => {
        if (process.domain) {
          DOMAIN_TO_LOGGER.set(process.domain, bole(`${this.name}:${req.id}`))
        }
        return oldRunFunction()
      }
    }
  }
}

function patch (obj) {
  const patchMap = new Map([
    ['log', 'info'],
    ['info', 'info'],
    ['warn', 'warn'],
    ['error', 'error']
  ])

  for (var xs of patchMap) {
    const originalMethod = obj[xs[0]]
    const targetMethod = xs[1]
    obj[xs[0]] = createPatched(originalMethod, targetMethod)
  }
}

function createPatched (originalMethod, targetMethod) {
  return patched

  function patched () {
    if (!process.domain || !DOMAIN_TO_LOGGER.has(process.domain)) {
      return originalMethod.apply(this, arguments)
    }
    const targetLogger = DOMAIN_TO_LOGGER.get(process.domain)
    return targetLogger[targetMethod].apply(targetLogger, arguments)
  }
}
