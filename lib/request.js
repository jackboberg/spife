'use strict'

module.exports = makeKnorkRequest

const Writable = require('stream').Writable
const range = require('range-parser')
const Promise = require('bluebird')
const accepts = require('accepts')
const cookie = require('cookie')
const crypto = require('crypto')
const uuid = require('uuid')
const url = require('url')

const ResponseStandin = require('./response-standin')
const reply = require('./reply')

const KNORK_TO_REQ = new WeakMap()
const KNORK_TO_IMPL = new WeakMap()

function makeKnorkRequest (req, server) {
  return new KnorkRequest(req, server)
}

class KnorkRequest {
  constructor (req, server) {
    KNORK_TO_REQ.set(this, req)
    KNORK_TO_IMPL.set(this, new Impl(this, server))
  }

  cookies () {
    return KNORK_TO_IMPL.get(this).cookies()
  }

  cookie (name) {
    return KNORK_TO_IMPL.get(this).cookie(name)
  }

  createResponseStandin () {
    return new ResponseStandin()
  }
  metric (value) {
    return KNORK_TO_IMPL.get(this).metric(value)
  }
  _logRaw (data) {
    return console.log(KNORK_TO_REQ.get(this))
  }
  get raw () {
    KNORK_TO_IMPL.get(this).disableBody(new Error(
      'Cannot read the body if "raw" has been accessed.'
    ))
    return KNORK_TO_REQ.get(this)
  }
  get pipe () {
    return () => {
      return this.raw.pipe.apply(this.raw, arguments)
    }
  }
  get id () {
    return KNORK_TO_IMPL.get(this).getID()
  }
  get body () {
    return KNORK_TO_IMPL.get(this).getBody()
  }
  get headers () {
    return KNORK_TO_REQ.get(this).headers
  }
  get rawHeaders () {
    return KNORK_TO_REQ.get(this).rawHeaders
  }
  get urlObject () {
    return KNORK_TO_IMPL.get(this).getURL()
  }
  get url () {
    return KNORK_TO_REQ.get(this).url
  }
  get query () {
    return KNORK_TO_IMPL.get(this).getURL().query
  }
  get method () {
    return KNORK_TO_REQ.get(this).method
  }
  get httpVersion () {
    return KNORK_TO_REQ.get(this).httpVersion
  }
  getRanges (size, opts) {
    if (size) {
      return range(size, this.headers.ranges || '', opts)
    }
    return range(Infinity, this.headers.ranges || '', opts)
  }
  get accept () {
    return KNORK_TO_IMPL.get(this).getAccepts()
  }
}

const ID_SCRATCH_BUFFER = new Buffer(16)

class Impl {
  constructor (kreq, server) {
    this.kreq = kreq
    this.id = (
      server.opts.isExternal
        ? hashIncoming(
            KNORK_TO_REQ.get(kreq).headers,
            server.opts.requestIDHeaders || ['request-id']
          )
        : KNORK_TO_REQ.get(kreq).headers['request-id'] || null
    )
    this.url = null
    this.accept = null
    this.body = null
    this.metrics = server.metrics
    this.maxBodySize = server.opts.maxBodySize
    this._getBody = () => getBody(this, KNORK_TO_REQ.get(kreq))

    const cookieHeader = this.kreq.headers['cookie']
    this._cookies = (
      cookieHeader
      ? _parseCookieHeader(cookieHeader)
      : null
    )
  }

  cookie (name) {
    if (!this._cookies) {
      return null
    }
    if (name in this._cookies) {
      return this._cookies[name]
    }
    return null
  }

  cookies () {
    if (!this._cookies) {
      return null
    }

    return Object.assign({}, this._cookies)
  }

  metric (value) {
    return this.metrics.metric(value)
  }
  getID () {
    if (this.id) {
      return this.id
    }
    uuid.v4(null, ID_SCRATCH_BUFFER)
    this.id = ID_SCRATCH_BUFFER.toString('base64')
    return this.id
  }
  getURL () {
    if (this.url) {
      return this.url
    }
    this.url = url.parse(KNORK_TO_REQ.get(this.kreq).url, true)
    return this.url
  }
  getAccepts () {
    if (this.accept) {
      return this.accept
    }
    this.accept = accepts(KNORK_TO_REQ.get(this.kreq))
    return this.accept
  }
  getBody () {
    if (this.body) {
      return this.body
    }
    this.body = this._getBody()
    return this.body
  }
  disableBody (reason) {
    this._getBody = () => getDisabledBody(reason)
  }
}

function hashIncoming (headers, search) {
  for (var i = 0; i < search.length; ++i) {
    if (search[i].toLowerCase() in headers) {
      break
    }
  }
  if (i === search.length) {
    return null
  }
  const hash = crypto.createHash('sha1').update(
    headers[search[i]]
  ).digest('base64')
  return `${hash}-${generateID()}`
}

function generateID () {
  uuid.v4(null, ID_SCRATCH_BUFFER)
  return ID_SCRATCH_BUFFER.toString('base64')
}

function getBody (impl, req) {
  var resolve = null
  var reject = null
  /* eslint-disable promise/param-names */
  const promise = new Promise((_resolve, _reject) => {
    resolve = _resolve
    reject = _reject
  })
  /* eslint-enable promise/param-names */

  collectBody()
  return promise

  function collectBody () {
    var bytesWritten = 0
    const acc = []
    req.pipe(new Writable({
      write (chunk, enc, ready) {
        bytesWritten += chunk.length
        acc.push(chunk)
        if (bytesWritten < impl.maxBodySize) {
          return ready()
        }
        req.unpipe(this)
        this._write = () => {}
        const err = new reply.PayloadTooLargeError()
        reject(err)
        ready()
      }
    })).on('finish', () => {
      if (!acc.length) {
        return resolve(null)
      }
      return Promise.try(() => {
        return JSON.parse(Buffer.concat(acc).toString('utf8'))
      }).then(obj => resolve(obj))
        .catch(() => reject(new reply.BadRequestError()))
    })
  }
}

function getDisabledBody (reason) {
  /* eslint-disable promise/param-names */
  return new Promise((_, reject) => {
    setImmediate(() => reject(reason))
  })
  /* eslint-enable promise/param-names */
}

function _parseCookieHeader (header) {
  return (Array.isArray(header) ? header : [header]).map(
    xs => cookie.parse(xs)
  ).reduce((lhs, rhs) => Object.assign(lhs, rhs), {})
}
