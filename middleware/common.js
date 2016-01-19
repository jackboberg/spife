'use strict'

module.exports = createMiddleware

const reply = require('../reply')

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
      if (!reply.status(response)) {
        reply.status(response, 200)
      }
    },
    processError (req, err) {
      if (!reply.status(err)) {
        if (this.isExternal && process.env.ENVIRONMENT === 'production') {
          throw new reply.InternalServerError(
            `An Internal Server Error occurred.`
          )
        }
        reply.status(err, 500)
      }
      err['request_id'] = req.id
    }
  }
}
