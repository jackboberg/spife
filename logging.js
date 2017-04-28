'use strict'

module.exports = createLogger

const domainToRequest = require('./lib/domain-to-request')
const bole = require('bole')

Object.assign(createLogger, bole)

function createLogger (name) {
  const logger = bole(name)

  return Object.assign(subname => {
    return createLogger(`${name}:${subname}`)
  }, {
    debug (...args) {
      const req = domainToRequest.request
      if (req) {
        return logger(req.id).debug(...args)
      }
      return logger.debug(...args)
    },
    info (...args) {
      const req = domainToRequest.request
      if (req) {
        return logger(req.id).info(...args)
      }
      return logger.info(...args)
    },
    warn (...args) {
      const req = domainToRequest.request
      if (req) {
        return logger(req.id).warn(...args)
      }
      return logger.warn(...args)
    },
    error (...args) {
      const req = domainToRequest.request
      if (req) {
        return logger(req.id).error(...args)
      }
      return logger.error(...args)
    }
  })
}
