'use strict'

module.exports = rethrow

const reply = require('../reply')

function rethrow (code, headers) {
  return err => {
    throw headers
      ? reply(err, code, headers)
      : reply(err, code)
  }
}
