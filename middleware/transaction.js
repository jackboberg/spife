'use strict'

module.exports = createTransactionMiddleware

const db = require('../db/session')

function createTransactionMiddleware () {
  return {processView}

  function processView (req, match, context, next) {
    if (match.controller[match.name].noTransaction) {
      return next(req, match, context)
    }

    return db.transaction(() => {
      return next(req, match, context)
    })()
  }
}
