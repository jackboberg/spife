'use strict'

const decorate = require('@npm/decorate')
const db = require('../db/session')

module.exports = {
  noTransaction (op) {
    const result = decorate(op, function (...args) {
      return op.call(this, arguments)
    })
    result.noTransaction = true
    return result
  },
  atomic (op) {
    return decorate(op, db.atomic)
  },
  transaction (op) {
    return decorate(op, db.transaction)
  }
}
