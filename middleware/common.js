'use strict'

module.exports = createMiddleware

const publicHTTP = require('../http')

function createMiddleware () {
  return {
    install (knork) {
      this.isExternal = knork.opts.isExternal
    },
    processResponse (req, response) {
      if (typeof response !== 'object') {
        throw new Error(
          `responses should be an object, not ${typeof response}`
        )
      }
      if (!publicHTTP.status(response)) {
        publicHTTP.status(response, 200)
      }
    },
    processError (req, err) {
      if (!publicHTTP.status(err)) {
        if (this.isExternal && process.env.ENVIRONMENT === 'production') {
          throw new publicHTTP.InternalServerError(
            `An Internal Server Error occurred.`
          )
        }
        publicHTTP.status(err, 500)
      }
      err['request_id'] = req.id
    }
  }
}
