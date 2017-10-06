'use strict'

module.exports = response

const linkFormat = require('format-link-header')
const linkParse = require('parse-link-header')
const statuses = require('statuses')
const stream = require('stream')
const cookie = require('cookie')

const TEMPLATE_SYM = Symbol('http-template')
const STATUS_SYM = Symbol('http-status')
const HEADER_SYM = Symbol('http-header')
const COOKIE_SYM = Symbol('http-cookie')

class HTTPError extends Error {
  constructor (msg, code) {
    super(msg)
    status(this, code)
  }
}

class ServerError extends HTTPError {
}

class ClientError extends HTTPError {
}

Object.assign(addErrors(response), {
  cookie: setCookie,
  template,
  toStream,
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

function template (name, response) {
  if (arguments.length === 1) {
    return name[TEMPLATE_SYM]
  }

  response = response || {}
  response[TEMPLATE_SYM] = name
  return response
}

function toStream (data) {
  if (!data) {
    data = raw('')
  }
  const isStream = (
    data.pipe &&
    typeof data.on === 'function' &&
    typeof data.pipe === 'function'
  )
  const out = (
    data &&
    isStream &&
    data._readableState &&
    data._readableState.objectMode
  ) ? _objectModeToNLJSON(data)
    : response(data)

  if (isStream) {
    return out
  }

  const headers = response.headers(out) || {}
  const status = response.status(out)

  headers['content-type'] = headers['content-type'] || (
    Buffer.isBuffer(out)
    ? 'application/octet-stream'
    : 'application/json; charset=utf-8'
  )

  const asOctetStream = (
    Buffer.isBuffer(out)
    ? out
    : Buffer.from(JSON.stringify(out), 'utf8')
  )
  headers['content-length'] = asOctetStream.length
  const outputStream = new stream.Readable({
    read (n) {
      this.push(asOctetStream)
      this.push(null)
      this._read = () => {}
    }
  })

  return response(outputStream, status || 200, headers)
}

function _objectModeToNLJSON (data) {
  const headers = response.headers(data) || {}
  const status = response.status(data)
  const output = data.pipe(new stream.Transform({
    objectMode: true,
    transform (chunk, _, ready) {
      if (this.closed) {
        return ready()
      }
      try {
        chunk = JSON.stringify(chunk)
      } catch (err) {
        this.closed = true
        this.push(JSON.stringify({error: err.message}) + '\n')
        this.push(null)
        return ready()
      }
      ready(null, chunk + '\n')
    }
  }))

  if (!('content-type' in headers)) {
    headers['content-type'] = 'application/x-ndjson; charset=utf-8'
  }

  return response(output, status, headers)
}

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
    out[checkHeader(key.toLowerCase())] = (
      Array.isArray(value[key])
      ? value[key].map(checkHeader)
      : checkHeader(value[key])
    )
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
  resp[HEADER_SYM][checkHeader(String(header).toLowerCase())] = (
    Array.isArray(value)
    ? value.map(checkHeader)
    : checkHeader(value)
  )

  return resp
}

function checkHeader (str) {
  str = String(str)
  if (/^[\u0000-\u0009\u000b\u000c\u000e-\u007F]+$/g.test(str)) {
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
  if (typeof value === 'object') {
    return value
  }
  const output = new stream.Readable({
    read (n) {
      while (this.original.length) {
        const chunk = this.original.slice(0, n)
        this.original = this.original.slice(n)
        if (!this.push(chunk)) {
          break
        }
      }
      if (!this.original.length) {
        return this.push(null)
      }
    }
  })
  output.original = value || ''
  if (output.original.length) {
    header(output, 'content-type', 'text/plain; charset=utf-8')
  }
  return output
}

function empty (code) {
  return status(raw(''), code || 204)
}

function redirect (resp, to, code) {
  if (arguments.length === 1) {
    return header(empty(302), 'location', resp)
  }
  return header(status(resp, code || 302), 'location', to)
}

function setCookie (resp, name, value, options) {
  if (!resp) {
    resp = raw('')
  }
  resp = response(resp)
  const cookie = (
    resp[COOKIE_SYM]
    ? resp[COOKIE_SYM]
    : (resp[COOKIE_SYM] = new Map())
  )

  if (arguments.length === 1) {
    return cookie
  }

  if (arguments.length === 2) {
    return cookie.get(name)
  }

  options = Object.assign({
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/',
    domain: null,
    expires: null,
    maxAge: null
  }, options || {})

  cookie.set(name, {
    value,
    options
  })

  _renderSetCookieHeader(resp, cookie)

  return resp
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

    /* eslint-disable no-new-func */
    exports[className] = Function('superClass', 'defaultMessage', 'code', `
      'use strict'
      return class ${className} extends superClass {
        constructor (msg) {
          super(msg || defaultMessage, code)
          Error.captureStackTrace(this, ${className})
        }
      }
    `)(code < 500 ? ClientError : ServerError, statuses[code], code)
    /* eslint-enable no-new-func */
  })

  return exports
}

function toIdentifier (str) {
  return str.split(' ').map(function (token) {
    return token.slice(0, 1).toUpperCase() + token.slice(1)
  }).join('').replace(/[^ _0-9a-z]/gi, '')
}

function _renderSetCookieHeader (resp, cookieObject) {
  const result = Array.from(cookieObject).reduce((acc, pair) => {
    acc.push(cookie.serialize(pair[0], pair[1].value, pair[1].options))
    return acc
  }, [])

  return header(resp, 'set-cookie', result)
}
