'use strict'

module.exports = createFormParsingMW

const querystring = require('querystring')
const {concat} = require('mississippi')
const Promise = require('bluebird')

const MIME = 'application/x-www-form-urlencoded'

function createFormParsingMW ({
  accept = (req) => {
    return req.headers['content-type'].indexOf(MIME) !== -1
  }
} = {}) {
  return {
    processBody (req, stream, next) {
      if (!accept(req)) {
        return next()
      }

      return new Promise((resolve, reject) => {
        stream.on('error', reject).pipe(concat(stream, resolve))
      }).then(buf => {
        return querystring.parse(buf.toString('utf8'))
      })
    }
  }
}
