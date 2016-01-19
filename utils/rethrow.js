'use strict'

module.exports = rethrow

const reply = require('../reply')

function rethrow (code) {
  return err => {
    throw reply.status(err, code)
  }
}
