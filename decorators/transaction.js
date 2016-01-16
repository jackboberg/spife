'use strict'

const db = require('../db/session')

module.exports = {
  noTransaction,
  atomic: db.atomic,
  transaction: db.transaction
}

function noTransaction (op) {
  inner.noTransaction = true
  return inner

  function inner () {
    return op.apply(this, arguments)
  }
}
