'use strict'

const range = require('range-parser')
const MiniPass = require('minipass')
const Promise = require('bluebird')
const accepts = require('accepts')
const cookie = require('cookie')
const uuid = require('uuid')
const url = require('url')

const ResponseStandin = require('./response-standin')

const KNORK_TO_REQ = new WeakMap()
const KNORK_TO_IMPL = new WeakMap()

const logger = require('../logging')('request')

class SpifeRequest {
  constructor (req, server, parsed) {
    KNORK_TO_REQ.set(this, req)
    KNORK_TO_IMPL.set(this, new Impl(this, server, parsed))
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
    return KNORK_TO_IMPL.get(this).id
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
    return KNORK_TO_IMPL.get(this).parsedURL
  }
  get url () {
    return KNORK_TO_REQ.get(this).url
  }

  set url (u) {
    const req = KNORK_TO_REQ.get(this)
    if (req.url === u) {
      return u
    }
    req.url = u
    const impl = KNORK_TO_IMPL.get(this)
    impl.parsedURL = url.parse(u, true)
    return u
  }

  get query () {
    return KNORK_TO_IMPL.get(this).parsedURL.query
  }

  get method () {
    return KNORK_TO_REQ.get(this).method
  }
  set method (m) {
    const req = KNORK_TO_REQ.get(this)
    req.method = m
    return m
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

module.exports = SpifeRequest

class Impl {
  constructor (kreq, server, parsedURL) {
    this.kreq = kreq
    this.server = server
    this.parsedURL = parsedURL
    this._id = null
    this.body = null
    this.accept = null
    this.viewName = null
    this._cookies = undefined
    this.router = server.router
    this.start = Date.now()
  }

  get id () {
    if (this._id) {
      return this._id
    }
    this._id = (
      KNORK_TO_REQ.get(this.kreq).headers['request-id'] || generateID()
    )
    return this._id
  }

  _getBody () {
    return this.server.processBodyOnion(
      this.kreq,
      KNORK_TO_REQ.get(this.kreq).pipe(new MiniPass())
    )
  }

  cookie (name) {
    if (this._cookies === undefined) {
      this._cookies = (
        this.kreq.headers.cookie
        ? _parseCookieHeader(this.kreq.headers.cookie)
        : null
      )
    }

    if (!this._cookies) {
      return null
    }
    if (name in this._cookies) {
      return this._cookies[name]
    }
    return null
  }

  cookies () {
    if (this._cookies === undefined) {
      this._cookies = (
        this.kreq.headers.cookie
        ? _parseCookieHeader(this.kreq.headers.cookie)
        : null
      )
    }

    if (!this._cookies) {
      return null
    }

    return Object.assign({}, this._cookies)
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

const ID_SCRATCH_BUFFER = Buffer.alloc(16)
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
