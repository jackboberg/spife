'use strict'

module.exports = createJSONParsingMW

const {concat} = require('mississippi')
const Promise = require('bluebird')

const reply = require('../reply')

function createJSONParsingMW ({accept = (req) => true} = {}) {
  return {
    processBody (req, stream, next) {
      if (!accept(req)) {
        return next(req, stream)
      }

      return new Promise((resolve, reject) => {
        stream.on('error', reject).pipe(concat(stream, resolve))
      }).then(buf => {
        if (buf.length === 0) {
          return null
        }
        return JSON.parse(buf.toString('utf8'))
      }).catch(SyntaxError, () => {
        throw new reply.BadRequestError('could not parse json')
      })
    }
  }
}
