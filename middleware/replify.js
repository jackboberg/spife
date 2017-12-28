'use strict'

module.exports = createMiddleware

const replify = require('replify')

function createMiddleware (settings) {
  return {
    processServer (knork, next) {
      replify({name: `${knork.name}-${process.pid}`}, knork.server, {settings})
      return next(knork)
    }
  }
}
