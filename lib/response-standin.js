'use strict'

const Duplex = require('stream').Duplex

const reply = require('./reply')

module.exports = createRequest

function createRequest () {
  const data = []
  const stream = new Duplex({
    write (chunk, enc, callback) {
      data.push(chunk)
      process.nextTick(callback)
    },
    read () {
      while (data.length) {
        stream.push(data.shift())
      }
    },
    allowHalfOpen: true
  })

  stream.finished = false
  stream.once('finish', () => {
    data.push(null)
  })
  stream.once('end', () => {
    stream.finished = true
  })

  Object.defineProperty(stream, 'statusCode', {
    get () {
      return reply.status(stream)
    },
    set (v) {
      return reply.status(stream, v)
    }
  })

  return Object.assign(stream, {
    writeHead (code, headers) {
      stream.statusCode = code
      for (var key in headers) {
        stream.setHeader(key, headers[key])
      }
    },

    setHeader (header, value) {
      reply.header(this, header, value)
    },

    getHeader (header) {
      return reply.header(this, header)
    }
  })
}
