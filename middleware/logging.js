'use strict'

module.exports = createLoggingMiddleware

const bistre = require('bistre')

const bole = require('../logging')
const reply = require('../reply')

const logger = bole('request')

function createLoggingMiddleware (opts) {
  opts = Object.assign({
    level: 'info',
    stream: null
  }, opts || {})

  return {
    processServer (server, next) {
      if (opts.stream === null) {
        const pretty = bistre()
        opts.stream = (
          process.stdout.isTTY &&
          process.env.ENVIRONMENT !== 'production' &&
          process.env.ENVIRONMENT !== 'staging'
        ) ? (pretty.pipe(process.stdout), pretty) : process.stdout
      }
      bole.output(opts)
      return next().then(() => {
        bole.reset()
      })
    },

    processRequest (req, next) {
      req._logRaw()
      return next().then(res => {
        logger.info({
          url: req.url,
          statusCode: reply.status(res) || 200,
          headers: reply.headers(res),
          method: req.method,
          latency: req.latency
        })

        return res
      }).catch(err => {
        const status = reply.status(err) || 500
        logger.info({
          url: req.url,
          statusCode: status,
          error: err.message,
          headers: reply.headers(err),
          method: req.method,
          latency: req.latency
        })

        if (status >= 500) {
          logger.error(err)
        }

        throw err
      })
    }
  }
}
