'use strict'

const stream = require('stream')

const reply = require('./reply')

module.exports = class ResponseStream extends stream.PassThrough {
  setHeader (header, value) {
    reply.header(this, header, value)
  }

  get statusCode () {
    return reply.status(this)
  }

  set statusCode (v) {
    return reply.status(this, v)
  }
}

