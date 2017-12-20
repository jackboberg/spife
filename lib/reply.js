'use strict'

module.exports = response

const linkFormat = require('format-link-header')
const linkParse = require('parse-link-header')
const statuses = require('statuses')
const stream = require('stream')
const cookie = require('cookie')

const TEMPLATE_SYM = Symbol.for('knork-http-template')
const STATUS_SYM = Symbol.for('knork-http-status')
const HEADER_SYM = Symbol.for('knork-http-header')
const COOKIE_SYM = Symbol.for('knork-http-cookie')

const PROP_TO_CACHE_CONTROL = [
  ['mustRevalidate', 'must-revalidate'],
  ['noCache', 'no-cache'],
  ['noStore', 'no-store'],
  ['noTransform', 'no-transform'],
  ['public', 'public'],
  ['private', 'private'],
  ['proxyRevalidate', 'proxy-revalidate'],
  ['maxAge', 'max-age'],
  ['sharedMaxAge', 's-maxage'],
  ['immutable', 'immutable'],
  ['staleWhileRevalidate', 'stale-while-revalidate'],
  ['staleIfError', 'stale-if-error']
]
const CACHE_CONTROL_TO_PROP = new Map(
  PROP_TO_CACHE_CONTROL.map(xs => [xs[1], xs[0]])
)
const CACHE_CONTROL_TOGGLES = new Set([
  'mustRevalidate',
  'noCache',
  'noStore',
  'noTransform',
  'public',
  'private',
  'proxyRevalidate',
  'immutable'
])

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
  vary,
  cacheControl,
  HTTPError,
  ServerError,
  ClientError
})

function template (name, response) {
  if (arguments.length === 1) {
    return (
      name
      ? (
        typeof name === 'string'
        ? template(name, {})
        : name[TEMPLATE_SYM]
      )
      : null
    )
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
  const isBuffer = Buffer.isBuffer(out)
  headers['content-type'] = headers['content-type'] || (
    isBuffer
    ? 'application/octet-stream'
    : 'application/json; charset=utf-8'
  )

  if (isBuffer) {
    headers['content-length'] = out.length
    return response({
      on () {
      },
      pipe (dst) {
        dst.end(out)
      }
    }, status || 200, headers)
  }

  return response({
    on () {
    },
    pipe (dst) {
      dst.end(JSON.stringify(out), 'utf8')
    }
  }, status || 200, headers)
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

function vary (resp, on) {
  if (!resp) {
    resp = raw('')
  }
  resp = response(resp)

  if (arguments.length === 1) {
    const value = header(resp, 'vary')
    return (
      value
      ? value.split(/,\s*/g)
      : []
    )
  }

  on = (
    Array.isArray(on)
    ? on
    : [on]
  )

  return header(resp, 'vary', Array.from(new Set(on)).join(', '))
}

function cacheControl (resp, settings) {
  if (!resp) {
    resp = raw('')
  }
  resp = response(resp)
  const current = header(resp, 'cache-control')
  const parsed = current
    ? parseCacheControl(current)
    : {}

  if (arguments.length === 1) {
    return parsed
  }

  return header(resp, 'cache-control', formatCacheControl(
    parsed,
    settings
  ))
}

function formatCacheControl (lhs, rhs) {
  if (rhs.public && rhs.private) {
    throw new Error('Cannot set Cache-Control public and private at once.')
  }

  const cacheControl = Object.assign(lhs, rhs)

  if (rhs.public) {
    cacheControl.private = false
  } else if (rhs.private) {
    cacheControl.public = false
  }

  return PROP_TO_CACHE_CONTROL.reduce((acc, [prop, ccontrolValue]) => {
    const isToggle = CACHE_CONTROL_TOGGLES.has(prop)

    // if it's a toggle and it's false, skip it
    // if it's not a toggle and it's not a number, skip it
    if (
      (isToggle && !cacheControl[prop]) ||
      (!isToggle && isNaN(cacheControl[prop]))
    ) {
      return acc
    }

    acc.push(
      isToggle
      ? ccontrolValue
      : `${ccontrolValue}=${Math.floor(cacheControl[prop])}`
    )

    return acc
  }, []).join(', ')
}

function parseCacheControl (str) {
  const bits = str.split(/,\s*/g)

  return bits.reduce((lhs, rhs) => {
    rhs = rhs.split('=')

    const prop = CACHE_CONTROL_TO_PROP.get(rhs[0].trim())

    if (prop) {
      lhs[prop] = CACHE_CONTROL_TOGGLES.has(prop) ? true : Number(rhs[1].trim())
    }

    return lhs
  }, {})
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

  class NoMatchError extends exports.NotFoundError {
    constructor (msg) {
      super()
      Error.captureStackTrace(this, NoMatchError)
    }
  }
  exports.NoMatchError = NoMatchError

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
