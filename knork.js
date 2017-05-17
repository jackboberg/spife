'use strict'

module.exports = makeKnork

const Transform = require('stream').Transform
const Readable = require('stream').Readable
const Emitter = require('numbat-emitter')
const Promise = require('bluebird')
const ms = require('mississippi')

/* eslint-disable node/no-deprecated-api */
const domain = require('domain')
/* eslint-enable node/no-deprecated-api */

const domainToRequest = require('./lib/domain-to-request')
const makeKnorkRequest = require('./lib/request')
const reply = require('./reply')

const IGNORE_RESPONSES = true

const DEBUG = (
  process.env.DEBUG ||
  !new Set(['staging', 'production']).has(process.env.NODE_ENV)
)

function makeKnork (name, server, urls, middleware, opts) {
  opts = Object.assign({
    maxBodySize: 1 << 20, // default to 1mb
    metrics: null,
    isExternal: true,
    enableFormParsing: false,
    requestIDHeaders: ['request-id'],
    onclienterror: () => {}
  }, opts || {})
  if (isNaN(opts.maxBodySize) || opts.maxBodySize < 0) {
    throw new Error(`
  maxBodySize should be a positive integer, got ${opts.maxBodySize} instead
    `.trim())
  }
  var resolveClosed = null
  var rejectClosed = null
  const closed = new Promise((resolve, reject) => {
    resolveClosed = resolve
    rejectClosed = reject
  })
  const knork = new Server(name, server, urls, middleware || [], closed, opts)
  server.once('close', () => {
    // we dereference the install promise here so that we ensure that it
    // has completed before we start shutting the middleware down.
    install.then(() => {
      _iterateMiddleware(knork.reverseMiddleware, (mw, resolve, reject) => {
        if (!mw.onServerClose) {
          return resolve()
        }
        Promise.resolve(mw.onServerClose(knork)).then(resolve, reject)
      }, resolve => resolve(), IGNORE_RESPONSES).then(
        resolveClosed,
        rejectClosed
      )
    })
  })

  const install = _iterateMiddleware(knork.middleware, (mw, resolve, reject) => {
    if (!mw.install) {
      return resolve()
    }
    Promise.resolve(mw.install(knork)).then(resolve, reject)
  }, (resolve, reject) => resolve(), IGNORE_RESPONSES).return(knork)

  return install
}

class Server {
  constructor (name, server, urls, middleware, closed, opts) {
    this.name = name
    this.urls = urls
    this.middleware = middleware
    this.reverseMiddleware = middleware.slice().reverse()
    this.server = server
    this.opts = opts
    this.closed = closed
    server.removeAllListeners('request')
    server
      .on('request', (req, res) => this.onrequest(req, res))
      .on('clientError', (err, sock) => opts.onclienterror(err, sock))

    // standard has bad opinions about ternaries. there, I said it.
    /* eslint-disable operator-linebreak */
    this.metrics = (
      opts.metrics && typeof opts.metrics === 'object' ? opts.metrics :
      typeof opts.metrics === 'string' ? createMetrics(this.name, opts.metrics) :
      process.env.METRICS ? createMetrics(this.name, process.env.METRICS) :
      createFakeMetrics()
    )
    /* eslint-enable operator-linebreak */
  }

  onrequest (req, res) {
    const subdomain = domain.create()
    const kreq = makeKnorkRequest(req, this)
    subdomain.add(req)
    subdomain.add(res)
    const getResult = subdomain.run(() => {
      domainToRequest.request = kreq
      return runProcessRequest(this, kreq).then(userResponse => {
        if (userResponse) {
          return userResponse
        }
        return runProcessView(this, kreq)
      }).then(userResponse => {
        userResponse = userResponse
          ? reply(userResponse)
          : reply(userResponse || '', 204)

        return runProcessResponse(this, kreq, userResponse)
      }).catch(err => {
        return runProcessError(this, kreq, err)
      }).then(
        resp => handleResponse(this, kreq, resp),
        err => handleLifecycleError(this, kreq, err)
      ).then(response => {
        res.writeHead(response.status || 200, response.headers)
        return new Promise((resolve, reject) => {
          ms.pipe(response.stream, res, err => {
            err ? reject(err) : resolve()
          })
        })
      })
    })

    return getResult.finally(() => {
      subdomain.remove(req)
      subdomain.remove(res)
      subdomain.exit()
    }).catch(err => {
      handleStreamError(this, err)
    })
  }
}

function runProcessRequest (knork, request) {
  return _iterateMiddleware(knork.middleware, (mw, resolve, reject) => {
    if (!mw.processRequest) {
      return resolve()
    }
    Promise.try(() => mw.processRequest(request))
      .then(resolve, reject)
  }, resolve => resolve())
}

function runProcessView (knork, request) {
  var match = null
  const router = request.router
  try {
    match = router.match(request.method, request.urlObject.pathname)
  } catch (err) {
    throw new reply.NotImplementedError(
      `"${request.method} ${request.urlObject.pathname}" is not implemented.`
    )
  }
  if (!match) {
    if (DEBUG && request.urlObject.pathname === '/') {
      let routes = router.targets.map(function (target) {
        return target.method + ' ' + target.route[0]
      })
      return reply.status(JSON.stringify(routes, null, '\t'), 404)
    }
    throw new reply.NotFoundError()
  }
  match.execute = function () {
    return match.controller[match.name](request, context)
  }
  const context = new Map(function * () {
    const entries = Array.from(match).reverse()
    const name = []
    for (var xs of entries) {
      yield * xs.context
      name.push(xs.name)
    }
    request.viewName = name.join('.')
  }())

  return _iterateMiddleware(knork.middleware, (mw, resolve, reject) => {
    if (!mw.processView) {
      return resolve()
    }
    Promise.try(() => mw.processView(request, match, context))
      .then(resolve, reject)
  }, (resolve, reject) => {
    try {
      return resolve(match.execute())
    } catch (err) {
      return reject(err)
    }
  })
}

function runProcessResponse (knork, request, userResponse) {
  return _iterateMiddleware(knork.reverseMiddleware, (mw, resolve, reject) => {
    if (!mw.processResponse) {
      return resolve()
    }
    Promise.try(() => mw.processResponse(request, userResponse))
      .then(resolve, reject)
  }, resolve => resolve(userResponse))
}

function runProcessError (knork, request, err) {
  return _iterateMiddleware(knork.reverseMiddleware, (mw, resolve, reject) => {
    if (!mw.processError) {
      return resolve()
    }
    Promise.try(() => mw.processError(request, err))
      .then(resolve, reject)
  }, (resolve, reject) => reject(err))
}

function _iterateMiddleware (middleware, callMW, noResponse, ignoreResponse) {
  var resolve = null
  var reject = null
  var idx = 0

  /* eslint-disable promise/param-names */
  const promise = new Promise((_resolve, _reject) => {
    resolve = _resolve
    reject = _reject
  })
  /* eslint-enable promise/param-names */

  Promise.try(iter)

  return promise

  function iter (response) {
    if (response && !ignoreResponse) {
      if (typeof response === 'string') {
        response = reply.raw(response)
      }
      return resolve(response)
    }
    if (idx >= middleware.length) {
      return noResponse(resolve, reject)
    }
    const mw = middleware[idx++]
    callMW(mw, iter, reject)
  }
}

function handleLifecycleError (knork, req, err) {
  const out = reply(
    Object.assign(
      {message: err.message},
      knork.opts.isExternal ? {} : {stack: err.stack},
      err.context || {}
    ),
    reply.status(err) || 500,
    reply.headers(err)
  )
  return handleResponse(knork, req, out)
}

function _objectModeToNLJSON (data) {
  const headers = reply.headers(data) || {}
  const status = reply.status(data)
  const output = data.pipe(new Transform({
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

  return reply(output, status, headers)
}

function handleResponse (knork, req, data) {
  const resp = (
    data &&
    data.pipe &&
    data._readableState &&
    data._readableState.objectMode
  ) ? _objectModeToNLJSON(data)
    : reply(data)

  const headers = reply.headers(resp) || {}
  const status = reply.status(resp)

  if (resp.pipe) {
    return {
      status,
      headers,
      stream: resp
    }
  }

  if (!knork.opts.isExternal) {
    headers['request-id'] = req.id
  }

  if (!Buffer.isBuffer(data)) {
    headers['content-type'] = (
      headers['content-type'] ||
      'application/json; charset=utf-8'
    )
  } else {
    headers['content-type'] = (
      headers['content-type'] ||
      'application/octet-stream'
    )
  }

  try {
    const asOctetStream = (
      Buffer.isBuffer(resp)
      ? data
      : Buffer.from(
          process.env.DEBUG
          ? JSON.stringify(resp, null, 2)
          : JSON.stringify(resp), 'utf8'
        )
    )

    headers['content-length'] = asOctetStream.length
    const stream = new Readable({
      read (n) {
        this.push(this.original)
        this.push(null)
      }
    })
    stream.original = asOctetStream

    return {
      status,
      headers,
      stream
    }
  } catch (err) {
    return handleLifecycleError(knork, req, err)
  }
}

function handleStreamError (knork, err) {
  knork.server.emit('response-error', err)
}

function createMetrics (name, str) {
  const emitter = new Emitter({
    app: name,
    uri: str
  })
  if (Emitter.setGlobalEmitter) {
    Emitter.setGlobalEmitter(emitter)
  }
  return emitter
}

function createFakeMetrics () {
  return new (class { metric () {} })()
}
