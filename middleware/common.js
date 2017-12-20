'use strict'

module.exports = createMiddleware

const reply = require('../reply')

function createMiddleware () {
  let isExternal = false
  return {processRequest, processServer}

  function processRequest (req, next) {
    return next(req).then(response => {
      if (!reply.status(response)) {
        reply.status(response, 200)
      }
      return response
    }).catch(err => {
      if (!reply.status(err)) {
        if (isExternal && process.env.NODE_ENV === 'production') {
          throw new reply.InternalServerError(
            `An Internal Server Error occurred.`
          )
        }
      }

      err.context = err.context || {}
      err.context.requestID = req.id
      throw err
    })
  }

  function processServer (server, next) {
    isExternal = server.opts.isExternal
    return next(server)
  }
}
