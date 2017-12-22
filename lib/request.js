'use strict'

const range = require('range-parser')
const MiniPass = require('minipass')
const Promise = require('bluebird')
const accepts = require('accepts')
const cookie = require('cookie')
const crypto = require('crypto')
const uuid = require('uuid')
const url = require('url')

const ResponseStandin = require('./response-standin')
const onion = require('./onion')
const reply = require('./reply')

const KNORK_TO_REQ = new WeakMap()
const KNORK_TO_IMPL = new WeakMap()

const logger = require('../logging')('request')

class KnorkRequest {
  constructor (req, server) {
    KNORK_TO_REQ.set(this, req)
    KNORK_TO_IMPL.set(this, new Impl(this, server))
  }

  get router () {
    return KNORK_TO_IMPL.get(this).router
  }

  set router (v) {
    const impl = KNORK_TO_IMPL.get(this)
    impl.router = v
  }

  cookies () {
    return KNORK_TO_IMPL.get(this).cookies()
  }

  cookie (name) {
    return KNORK_TO_IMPL.get(this).cookie(name)
  }

  get remoteAddress () {
    return KNORK_TO_REQ.get(this).connection.remoteAddress
  }

  get remoteFamily () {
    return KNORK_TO_REQ.get(this).connection.remoteFamily
  }

  get remotePort () {
    return KNORK_TO_REQ.get(this).connection.remotePort
  }

  get latency () {
    return Date.now() - KNORK_TO_IMPL.get(this).start
  }

  get viewName () {
    return KNORK_TO_IMPL.get(this).viewName
  }

  set viewName (v) {
    KNORK_TO_IMPL.get(this).viewName = v
  }

  createResponseStandin () {
    return new ResponseStandin()
  }
  metric (value) {
    return KNORK_TO_IMPL.get(this).metric(value)
  }

  _logRaw (data) {
    return logger.info(KNORK_TO_REQ.get(this))
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

module.exports = KnorkRequest

const ID_SCRATCH_BUFFER = Buffer.alloc(16)

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
    this.router = server.urls
    this.metrics = server.metrics
    this.maxBodySize = server.opts.maxBodySize
    this._getBody = () => {
      return server.processBodyOnion(
        kreq,
        KNORK_TO_REQ.get(kreq).pipe(new MiniPass())
      )
    }

    const cookieHeader = this.kreq.headers['cookie']
    this._cookies = (
      cookieHeader
      ? _parseCookieHeader(cookieHeader)
      : null
    )

    this.viewName = null
    this.start = Date.now()
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

function getDisabledBody (reason) {
  /* eslint-disable promise/param-names */
  return new Promise((_, reject) => {
    setImmediate(() => reject(reason))
  })
  /* eslint-enable promise/param-names */
}

function _parseCookieHeader (header) {
  return (Array.isArray(header) ? header : header.split(',')).map(
    xs => cookie.parse(xs)
  ).reduce((lhs, rhs) => Object.assign(lhs, rhs), {})
}
