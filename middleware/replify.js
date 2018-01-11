'use strict'

module.exports = createMiddleware

const replify = require('replify')

function createMiddleware (settings) {
  return {
    processServer (spife, next) {
      replify({name: `${spife.name}-${process.pid}`}, spife.server, {settings})
      return next(spife)
    }
  }
}
