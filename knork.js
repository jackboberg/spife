'use strict'

module.exports = makeKnork

const Emitter = require('numbat-emitter')
const Promise = require('bluebird')
const ms = require('mississippi')
const once = require('once')

/* eslint-disable node/no-deprecated-api */
const domain = require('domain')
/* eslint-enable node/no-deprecated-api */

const domainToRequest = require('./lib/domain-to-request')
const makeKnorkRequest = require('./lib/request')
const Middleware = require('./lib/middleware')
const reply = require('./reply')

const ONREADY = Symbol('onready')

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

  middleware = (middleware || []).map(xs => Middleware.from(xs))

  const knork = new Server(
    name,
    server,
    urls,
    middleware || [],
    opts
  )

  const onclosed = new Promise((resolve, reject) => {
    server.once('close', resolve)
    server.once('error', reject)
  })

  const onready = new Promise((resolve, reject) => {
    server.once(ONREADY, resolve)
  })

  knork.closed = onion(
    middleware,
    (mw, ...args) => mw.processServer(...args),
    () => {},
    () => {
      server.emit(ONREADY, knork)
      return onclosed
    },
    knork
  )

  return onready
}

class Server {
  constructor (name, server, urls, middleware, opts) {
    this.name = name
    this.urls = urls
    this._middleware = null
    this.middleware = middleware
    this.server = server
    this.opts = opts
    this.closed = null
    server.removeAllListeners('request')
    server
      .on('request', (req, res) => this.onrequest(req, res))
      .on('clientError', (err, sock) => opts.onclienterror(err, sock))

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

  get middleware () {
    return this._middleware
  }

  set middleware (mw) {
    this._middleware = (mw || []).map(xs => Middleware.from(xs))
  }

  onrequest (req, res) {
    const subdomain = domain.create()
    const kreq = makeKnorkRequest(req, this)
    subdomain.add(req)
    subdomain.add(res)

    const check = {
      resolve: checkMiddlewareResolution,
      reject: checkMiddlewareRejection
    }
    const getResult = subdomain.run(() => {
      domainToRequest.request = kreq
      return onion(
        this.middleware,
        (mw, ...args) => mw.processRequest(...args),
        check,
        kreq => {
          let match = null
          try {
            match = kreq.router.match(kreq.method, kreq.urlObject.pathname)
          } catch (err) {
            throw new reply.NotImplementedError(
              `"${kreq.method} ${kreq.urlObject.pathname}" is not implemented.`
            )
          }

          if (!match) {
            throw new reply.NotFoundError()
          }

          const context = new Map(function * () {
            const entries = [...match].reverse()
            const name = []
            for (const xs of entries) {
              yield * xs.context
              name.push(xs.name)
            }
            kreq.viewName = name.join('.')
          }())

          return onion(
            this.middleware,
            (mw, ...args) => mw.processView(...args),
            check,
            (kreq, match, context) => {
              return Promise.try(
                () => match.controller[match.name](kreq, context)
              ).then(response => {
                return (
                  response
                  ? reply(response)
                  : reply(response || '', 204)
                )
              })
            },
            kreq,
            match,
            context
          )
        },
        kreq
      ).then(
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

function onion (mw, each, after, inner, ...args) {
  let idx = 0
  const argIdx = args.push(null) - 1

  return new Promise((resolve, reject) => {
    iter().then(resolve, reject)
  })

  function iter () {
    const middleware = mw[idx]
    if (!middleware) {
      return Promise.try(() => inner(...args)).then(
        after.resolve,
        after.reject
      )
    }

    idx += 1
    args[argIdx] = once(() => {
      return Promise.try(() => iter())
    })
    return Promise.try(() => each(middleware, ...args)).then(
      after.resolve,
      after.reject
    )
  }
}

function checkMiddlewareResolution (response) {
  if (!response) {
    throw new TypeError(
      `Expected middleware to resolve to a truthy value, got "${response}" instead`
    )
  }
  // always cast into a response of some sort
  return reply(
    response,
    reply.status(response) || 200,
    reply.headers(response) || {}
  )
}

function checkMiddlewareRejection (err) {
  if (!err || !(err instanceof Error)) {
    throw new TypeError(
      `Expected error to be instanceof Error, got "${err}" instead`
    )
  }

  throw reply(
    err,
    reply.status(err) || 500,
    reply.headers(err) || {}
  )
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

function handleResponse (knork, req, data) {
  try {
    const stream = reply.toStream(data)
    if (!knork.opts.isExternal) {
      reply.header(stream, 'request-id', req.id)
    }
    return {
      status: reply.status(stream),
      headers: reply.headers(stream),
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
  return {metric () { }}
}
