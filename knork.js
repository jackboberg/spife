'use strict'

module.exports = makeKnork

const Transform = require('stream').Transform
const Readable = require('stream').Readable
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
    const getResult = subdomain.run(() => {
      domainToRequest.request = kreq
      return onion(
        this.middleware,
        (mw, ...args) => mw.processRequest(...args),
        () => {
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
            () => {
              return match.controller[match.name](kreq, context)
            },
            kreq,
            match,
            context
          ).then(response => {
            return (
              response
              ? reply(response)
              : reply(response || '', 204)
            )
          })
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

function onion (mw, each, inner, ...args) {
  let idx = 0
  const argIdx = args.push(null) - 1

  return new Promise((resolve, reject) => {
    iter().then(resolve, reject)
  })

  function iter () {
    const middleware = mw[idx]
    if (!middleware) {
      return Promise.try(() => inner(...args))
    }

    idx += 1
    args[argIdx] = once(() => {
      return Promise.try(() => iter())
    })
    return Promise.try(() => each(middleware, ...args))
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
  return {metric () { }}
}
