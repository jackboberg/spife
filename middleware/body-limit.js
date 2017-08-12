'use strict'

module.exports = createBodyMaxSizeMW

const EE = require('events')

const reply = require('../reply')

const ONE_MB = 1 << 20

function createBodyMaxSizeMW ({max = ONE_MB} = {}) {
  return {
    processBody (req, stream, next) {
      let bytesWritten = 0
      EE.prototype.on.call(stream, 'data', chunk => {
        bytesWritten += chunk.length
        if (bytesWritten >= max) {
          stream.emit('error', new reply.PayloadTooLargeError())
        }
      })
      return next()
    }
  }
}
