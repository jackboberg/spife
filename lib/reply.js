'use strict'

const linkFormat = require('format-link-header')
const linkParse = require('parse-link-header')
const punycode = require('punycode')
const statuses = require('statuses')
const stream = require('stream')

const STATUS_SYM = Symbol('http-status')
const HEADER_SYM = Symbol('http-header')

class HTTPError extends Error {
  constructor (msg, code) {
    super(msg)
    status(this, code)
  }
}

class ServerError extends HTTPError {
  constructor (msg, code) {
    super(msg, code)
  }
}

class ClientError extends HTTPError {
  constructor (msg, code) {
    super(msg, code)
  }
}


module.exports = addErrors({
  status,
  headers,
  header,
  response,
  raw,
  empty,
  redirect,
  link,
  HTTPError,
  ServerError,
  ClientError
})

function status (resp, code) {
  if (typeof resp !== 'object') {
    resp = raw(resp)
  }
  if (arguments.length === 1) {
    return resp[STATUS_SYM]
  }
  resp[STATUS_SYM] = code
  return resp
}

function headers (resp, value) {
  if (typeof resp !== 'object') {
    resp = raw(resp)
  }
  if (arguments.length === 1) {
    return Object.assign({}, resp[HEADER_SYM] || {})
  }
  const out = {}
  for (var key in value) {
    out[checkHeader(key.toLowerCase())] = checkHeader(value[key])
  }
  resp[HEADER_SYM] = out
  return resp
}

function header (resp, header, value) {
  if (typeof resp !== 'object') {
    resp = raw(resp)
  }
  if (arguments.length === 2) {
    return (resp[HEADER_SYM] || {})[header]
  }
  resp[HEADER_SYM] = resp[HEADER_SYM] || {}
  resp[HEADER_SYM][checkHeader(String(header).toLowerCase())] =
    checkHeader(value)
  return resp
}

function checkHeader (str) {
  if (punycode.encode(str) === str) {
    return str
  }
  throw new Error('Only ISO-8859-1 strings are valid in headers')
}

function response (resp, code, headerObject) {
  if (typeof resp !== 'object') {
    resp = raw(resp)
  }
  if (arguments.length > 1) {
    resp = status(resp, code)
  }
  if (arguments.length > 2) {
    resp = headers(resp, headerObject)
  }
  return resp
}

function raw (value) {
  var bits = value || ''
  return new stream.Readable({
    read (n) {
      if (!bits.length) {
        return this.push(null)
      }
      while (this.push(bits.slice(0, n)) && bits.length) {
        bits = bits.slice(n)
      }
      if (!bits.length) {
        return this.push(null)
      }
    }
  })
}

function empty () {
  return raw('')
}

function redirect (resp, to, code) {
  if (arguments.length === 1) {
    return header(status(empty(), code || 302), 'location', resp)
  }
  return header(status(resp, code || 302), 'location', to)
}

function link (resp, rel, value) {
  if (!resp) {
    resp = raw('')
  }
  resp = response(resp)
  const current = header(resp, 'link')
  const parsed = current
    ? linkParse(current)
    : {}

  if (arguments.length === 1) {
    return parsed
  }

  if (arguments.length === 2) {
    return parsed[rel]
  }

  parsed[rel] = {
    rel: rel,
    url: value
  }

  return header(resp, 'link', linkFormat(parsed))
}

function addErrors (exports) {
  statuses.codes.forEach(code => {
    if (code < 400) {
      return
    }
    const name = toIdentifier(statuses[code])
    const className = name.match(/Error$/) ? name : name + 'Error'

    exports[className] = Function('superClass', 'defaultMessage', 'code', `
      'use strict'
      return class ${className} extends superClass {
        constructor (msg) {
          super(msg || defaultMessage, code)
          Error.captureStackTrace(this, ${className})
        }
      }
    `)(code < 500 ? ClientError : ServerError, statuses[code], code)
  })

  return exports
}

function toIdentifier(str) {
  return str.split(' ').map(function (token) {
    return token.slice(0, 1).toUpperCase() + token.slice(1)
  }).join('').replace(/[^ _0-9a-z]/gi, '')
}
