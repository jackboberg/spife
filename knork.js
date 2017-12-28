'use strict'

module.exports = makeKnork

const chain = require('@iterables/chain')
const Emitter = require('numbat-emitter')
const Promise = require('bluebird')
const url = require('url')

/* eslint-disable node/no-deprecated-api */
const domain = require('domain')
/* eslint-enable node/no-deprecated-api */

const domainToRequest = require('./lib/domain-to-request')
const KnorkRequest = require('./lib/request')
const onion = require('./lib/onion')
const reply = require('./reply')

const UNINSTALL = Symbol('uninstall')
const ONREADY = Symbol('onready')

const STATUS_SYM = Symbol.for('knork-http-status')
const HEADER_SYM = Symbol.for('knork-http-header')

function makeKnork (name, server, urls, middleware, opts) {
  opts = Object.assign({
    metrics: null,
    isExternal: true,
    requestIDHeaders: ['request-id'],
    onclienterror: () => {}
  }, opts || {})

  middleware = middleware || []

  const knork = new Server(
    name,
    server,
    urls,
    middleware || [],
    opts
  )

  const onready = new Promise((resolve, reject) => {
    server.once(ONREADY, resolve)
  })

  knork.closed = knork.processServerOnion(knork)

  return onready
}

class Server {
  constructor (name, server, router, middleware, opts) {
    this.name = name
    this.router = router
    this.server = server
    this.emitStreamError = this.server.emit.bind(this.server, 'response-error')
    this._middleware = null
    this.processBodyOnion = null
    this.processViewOnion = null
    this.processServerOnion = null
    this.processRequestOnion = null
    this.middleware = middleware
    this.opts = opts
    this.closed = null
    this.onrequest = this.onrequest.bind(this)
    this.onclienterror = opts.onclienterror.bind(this)

    server.removeAllListeners('request')
    server
      .on('request', this.onrequest)
      .on('clientError', this.onclienterror)

    this.metrics = (
      opts.metrics && typeof opts.metrics === 'object'
      ? opts.metrics
      : (
        typeof opts.metrics === 'string'
        ? createMetrics(this.name, opts.metrics)
        : (
          process.env.METRICS
          ? createMetrics(this.name, process.env.METRICS)
          : createFakeMetrics()
        )
      )
    )
  }

  get urls () {
    return this.router
  }

  set urls (v) {
    this.router = v
  }

  uninstall () {
    this.server.removeListener('request', this.onrequest)
    this.server.removeListener('clientError', this.onclienterror)
    this.server.emit(UNINSTALL)
    return this.closed
  }

  get middleware () {
    return this._middleware
  }

  set middleware (mw) {
    this._middleware = [...mw]

    const processServerMW = []
    const processRequestMW = [middlewareMembrane1]
    const processViewMW = [middlewareMembrane3]
    const processBodyMW = []

    for (const xs of this._middleware) {
      if (typeof xs.processServer === 'function') {
        processServerMW.push(xs.processServer.bind(xs))
      }

      if (typeof xs.processRequest === 'function') {
        processRequestMW.push(xs.processRequest.bind(xs))
        processRequestMW.push(middlewareMembrane1)
      }

      if (typeof xs.processView === 'function') {
        processViewMW.push(xs.processView.bind(xs))
        processViewMW.push(middlewareMembrane3)
      }

      if (typeof xs.processBody === 'function') {
        processBodyMW.push(xs.processBody.bind(xs))
      }
    }

    const onclosed = new Promise((resolve, reject) => {
      this.server.once(UNINSTALL, () => {
        this.server.removeListener('close', resolve)
        this.server.removeListener('error', reject)
        resolve()
      })
      this.server.once('close', resolve)
      this.server.once('error', reject)
    })

    this.processServerOnion = onion.sprout(
      processServerMW,
      () => {
        this.server.emit(ONREADY, this)
        return onclosed
      },
      1
    )

    this.processBodyOnion = onion.sprout(
      processBodyMW,
      async (req, result) => {
        throw new reply.UnsupportedMediaTypeError()
      },
      2
    )

    this.processViewOnion = onion.sprout(
      processViewMW,
      async (req, match, context) => {
        const response = await match.controller[match.name](
          req,
          context
        )
        return response || reply.empty()
      },
      3
    )

    this.processRequestOnion = onion.sprout(
      processRequestMW,
      async req => {
        var match
        try {
          match = req.router.match(req.method, req.urlObject.pathname)
        } catch (err) {
          throw new reply.NotImplementedError(
            `"${req.method} ${req.urlObject.pathname}" is not implemented.`
          )
        }

        if (!match) {
          throw new reply.NoMatchError()
        }

        const viewName = []
        let items = []
        for (const entry of match) {
          items = chain(entry.context, items)
          viewName.unshift(entry.name)
        }
        const context = new Map(items)
        req.viewName = viewName.join('.')

        return this.processViewOnion(req, match, context)
      },
      1
    )
  }

  async onrequest (req, res) {
    const subdomain = domain.create()
    const parsed = url.parse(req.url, true)
    const kreq = new KnorkRequest(req, this, parsed)
    subdomain.add(req)
    subdomain.add(res)
    subdomain.enter()
    domainToRequest.request = kreq
    const getResponse = this.processRequestOnion(kreq)
    getResponse.catch(() => {})
    subdomain.exit()

    var response
    try {
      response = handleResponse(this, kreq, await getResponse)
    } catch (err) {
      response = handleLifecycleError(this, kreq, err)
    }
    subdomain.remove(req)
    subdomain.remove(res)
    subdomain.exit()

    res.writeHead(response.status || 200, response.headers)
    res.on('unpipe', destroyStreamOnClose)
    res.on('error', this.emitStreamError)
    response.stream.pipe(res)
  }
}

function destroyStreamOnClose (stream) {
  if (stream.destroy) stream.destroy()
  else if (stream.close) stream.close()
  else stream.resume()
}

async function middlewareMembrane1 (req, next) {
  try {
    return checkMiddlewareResolution(await next(req))
  } catch (err) {
    throw checkMiddlewareRejection(err)
  }
}

async function middlewareMembrane3 (req, match, context, next) {
  try {
    return checkMiddlewareResolution(await next(req, match, context))
  } catch (err) {
    throw checkMiddlewareRejection(err)
  }
}

function checkMiddlewareResolution (response) {
  if (!response) {
    throw new TypeError(
      `Expected middleware to resolve to a truthy value, got "${response}" instead`
    )
  }

  // always cast into a response of some sort
  if (typeof response !== 'object') {
    return reply(response)
  }

  // it's already an object, let us use privileged APIs
  // to set the status/headers.
  if (!response[STATUS_SYM]) {
    response[STATUS_SYM] = 200
  }

  if (!response[HEADER_SYM]) {
    response[HEADER_SYM] = {}
  }

  return response
}

function checkMiddlewareRejection (err) {
  if (!err || !(err instanceof Error)) {
    throw new TypeError(
      `Expected error to be instanceof Error, got "${err}" instead`
    )
  }

  throw reply(
    err,
    err[STATUS_SYM] || 500,
    err[HEADER_SYM] || {}
  )
}

function handleLifecycleError (knork, req, err) {
  const out = reply(
    Object.assign(
      {message: err.message},
      knork.opts.isExternal ? {} : {stack: err.stack},
      err.context || {}
    ),
    err[STATUS_SYM] || 500,
    err[HEADER_SYM] || {}
  )
  return handleResponse(knork, req, out)
}

function handleResponse (knork, req, data) {
  try {
    const stream = reply.toStream(data)
    if (!knork.opts.isExternal) {
      reply.header(stream, 'request-id', req.id)
    }
    return {
      status: stream[STATUS_SYM],
      headers: stream[HEADER_SYM],
      stream
    }
  } catch (err) {
    return handleLifecycleError(knork, req, err)
  }
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
  return {metric () { }}
}
