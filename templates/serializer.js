'use strict'

module.exports = {define, symbol}

const {XFORM} = require('../lib/serialize')

function define (to, fn) {
  to[XFORM] = fn
  return to
}

function symbol () {
  return XFORM
}
