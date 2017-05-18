'use strict'

module.exports = createTransactionMiddleware

const db = require('../db/session')

function createTransactionMiddleware () {
  return {processView}

  function processView (req, match, context, next) {
    if (match.controller[match.name].noTransaction) {
      return next()
    }

    return db.transaction(() => {
      return next()
    })()
  }
}
