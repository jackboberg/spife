'use strict'

module.exports = createDebugMiddleware

function createDebugMiddleware () {
  return {
    processServer (server, next) {
      return next(server)
    }
  }
}
