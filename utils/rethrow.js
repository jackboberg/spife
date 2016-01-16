'use strict'

module.exports = rethrow

function rethrow (code) {
  return err => {
    throw Object.assign(err, {
      statusCode: code
    })
  }
}
