'use strict'

module.exports = makeKnork

const Readable = require('stream').Readable
const Emitter = require('numbat-emitter')
const Promise = require('bluebird')
const ms = require('mississippi')
const domain = require('domain')

const makeKnorkRequest = require('./lib/request')
const publicHTTP = require('./http')

function makeKnork (name, server, urls, middleware, opts) {
  opts = Object.assign({
    maxBodySize: 1 << 20, // default to 1mb
    metrics: null,
    isExternal: true
  }, opts || {})
  if (isNaN(opts.maxBodySize) || opts.maxBodySize < 0) {
    throw new Error(`
  maxBodySize should be a positive integer, got ${opts.maxBodySize} instead
    `.trim())
  }
  const knork = new Server(name, server, urls, middleware || [], opts)
  server.once('close', () => {
    // we dereference the install promise here so that we ensure that it
    // has completed before we start shutting the middleware down.
    install.then(() => {
      _iterateMiddleware(knork.middleware, (mw, resolve, reject) => {
        if (!mw.onServerClose) {
          return resolve()
        }
        mw.onServerClose(knork).then(resolve, reject)
      }, (resolve, reject) => resolve()).catch(err => {
        server.emit('error', err)
      })
    })
  })

  const install = _iterateMiddleware(knork.middleware, (mw, resolve, reject) => {
    if (!mw.install) {
      return resolve()
    }
    Promise.resolve(mw.install(knork)).then(resolve, reject)
  }, (resolve, reject) => resolve()).return(knork)

  return install
}

class Server {
  constructor (name, server, urls, middleware, opts) {
    this.name = name
    this.urls = urls
    this.middleware = middleware
    this.server = server
    this.opts = opts
    server.removeAllListeners('request')
    server
      .on('request', (req, res) => this.onrequest(req, res))
      .on('clientError', (err, sock) => this.onclienterror(err, sock))

    // standard has bad opinions about ternaries. there, I said it.
    /* eslint-disable operator-linebreak */
    this.metrics = (
      opts.metrics && typeof opts.metrics === 'object' ? opts.metrics :
      typeof opts.metrics === 'string' ? createMetrics(this.name, opts.metrics) :
      typeof process.env.METRICS === 'string' ? createMetrics(
        this.name, process.env.METRICS) :
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
      return runProcessRequest(this, kreq).then(userResponse => {
        if (userResponse) {
          return userResponse
        }
        return runProcessView(this, kreq)
      }).then(userResponse => {
        userResponse = publicHTTP.response(userResponse)

        return runProcessResponse(this, kreq, userResponse)
      }).catch(err => {
        return runProcessError(this, kreq, err)
      }).then(
        resp => handleResponse(this, kreq, resp),
        err => handleLifecycleError(this, kreq, err)
      ).then(response => {
        res.writeHead(response.status || 200, response.headers || {})
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

  onclienterror (err, sock) {

  }
}

function runProcessRequest (knork, request) {
  return _iterateMiddleware(knork.middleware, (mw, resolve, reject) => {
    if (!mw.processRequest) {
      return resolve()
    }
    Promise.resolve(mw.processRequest(request)).then(resolve, reject)
  }, resolve => resolve())
}

function runProcessView (knork, request) {
  const match = knork.urls.match(request.method, request.urlObject.pathname)
  if (!match) {
    throw new publicHTTP.NotFoundError()
  }
  match.execute = function () {
    return match.controller[match.name](request, context)
  }
  const context = new Map(function *() {
    const entries = Array.from(match).reverse()
    for (var xs of entries) {
      yield * xs.context
    }
  }())

  return _iterateMiddleware(knork.middleware, (mw, resolve, reject) => {
    if (!mw.processView) {
      return resolve()
    }
    Promise.try(() => {
      return Promise.resolve(mw.processView(request, match, context))
    }).then(resolve, reject)
  }, resolve => {
    return resolve(match.execute())
  })
}

function runProcessResponse (knork, request, userResponse) {
  return _iterateMiddleware(knork.middleware.slice().reverse(), (mw, resolve, reject) => {
    if (!mw.processResponse) {
      return resolve()
    }
    Promise.resolve(mw.processResponse(request, userResponse))
      .then(resolve, reject)
  }, resolve => resolve(userResponse))
}

function runProcessError (knork, request, err) {
  return _iterateMiddleware(knork.middleware.slice().reverse(), (mw, resolve, reject) => {
    if (!mw.processError) {
      return resolve()
    }
    Promise.resolve(mw.processError(request, err))
      .then(resolve, reject)
  }, (resolve, reject) => reject(err))
}

function _iterateMiddleware (middleware, callMW, noResponse) {
  const list = middleware.slice()
  var resolve = null
  var reject = null
  const promise = new Promise((_resolve, _reject) => {
    resolve = _resolve
    reject = _reject
  })

  Promise.try(iter)

  return promise

  function iter (response) {
    if (response) {
      if (typeof response === 'string') {
        response = publicHTTP.raw(response)
      }
      return resolve(response)
    }
    if (!list.length) {
      return noResponse(resolve, reject)
    }
    const mw = list.shift()
    callMW(mw, iter, reject)
  }
}

function handleLifecycleError (knork, req, err) {
  const out = publicHTTP.response(
    Object.assign(
      {message: err.message},
      knork.opts.isExternal ? {} : {stack: err.stack},
      err.context || {}
    ),
    publicHTTP.status(err) || 500,
    publicHTTP.headers(err)
  )
  return handleResponse(knork, req, out)
}

function handleResponse (knork, req, data) {
  const resp = publicHTTP.response(data)
  const headers = publicHTTP.headers(resp)
  const status = publicHTTP.status(resp)

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
    headers['content-type'] = 'application/json; charset=utf-8'
  }

  const asOctetStream = (
    Buffer.isBuffer(resp)
    ? data
    : new Buffer(
        process.env.DEBUG
        ? JSON.stringify(resp, null, 2)
        : JSON.stringify(resp), 'utf8'
      )
  )

  headers['content-length'] = asOctetStream.length
  const stream = new Readable({
    read (n) {
      this.push(asOctetStream)
      this.push(null)
    }
  })
  return {
    status,
    headers,
    stream
  }
}

function noop () {
}

function handleStreamError (knork, err) {

}

function createMetrics (name, str) {
  return new Emitter({
    app: name,
    uri: str
  })
}

function createFakeMetrics () {
  return new class { metric () {} }
}
