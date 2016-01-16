'use strict'

module.exports = createLoggingMiddleware

const bole = require('bole')

const DOMAIN_TO_LOGGER = new WeakMap()

function createLoggingMiddleware (logger, patchObject) {
  patchObject = patchObject || console
  patch(patchObject)
  return {
    install (knork) {
      this.name = knork.name
    },
    onRequest (req) {
      DOMAIN_TO_LOGGER.set(req, bole(`${this.name}:${req.id}`))
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
    return targetMethod.apply(targetLogger, arguments)
  }
}
