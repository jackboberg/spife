'use strict'

const Promise = require('bluebird')
const request = require('request')
const http = require('http')
const tap = require('tap')

const createTemplateMiddleware = require('../middleware/template')
const routes = require('../routing')
const reply = require('../reply')
const knork = require('..')

test('reply.template returns context on json', assert => {
  test.setController(routes`
    GET / index
  `({
    index (req, context) {
      return reply.template('greeting', {message: 'hello world'})
    }
  }))
  test.setMiddleware([
    createTemplateMiddleware([{
      get (key, req) {
        if (req.accept.type('json')) {
          return xs => ({name: key, context: xs})
        }

        return () => 'hi.'
      }
    }])
  ])

  return test.request({
    url: '/',
    json: true
  }).then(resp => {
    assert.deepEqual(resp.body, {
      name: 'greeting',
      context: {message: 'hello world'}
    })
  })
})

test('reply.template returns context loader context on json', assert => {
  test.setController(routes`
    GET / index
  `({
    index (req, context) {
      return reply.template('greeting', {message: 'hello world'})
    }
  }))
  test.setMiddleware([
    createTemplateMiddleware([{
      get (key, req) {
        if (req.accept.type('json')) {
          return xs => ({name: key, context: xs})
        }

        return () => 'hi.'
      }
    }], [
      req => ({expression: 'surprise'})
    ])
  ])

  return test.request({
    url: '/',
    json: true
  }).then(resp => {
    assert.deepEqual(resp.body, {
      name: 'greeting',
      context: {message: 'hello world', expression: 'surprise'}
    })
  })
})

test('reply.template renders html', assert => {
  test.setController(routes`
    GET / index
  `({
    index (req, context) {
      return reply.template('greeting', {message: 'hello world'})
    }
  }))
  test.setMiddleware([
    createTemplateMiddleware([{
      get (key, req) {
        if (req.accept.type('json')) {
          return xs => ({name: key, context: xs})
        }

        return () => 'hi.'
      }
    }], [
      req => ({expression: 'surprise'})
    ])
  ])

  return test.request({
    url: '/',
    headers: {accept: 'text/html'}
  }).then(resp => {
    assert.deepEqual(resp.body.toString(), 'hi.')
  })
})

test('reply.template loader falls back through loaders', assert => {
  test.setController(routes`
    GET / index
  `({
    index (req, context) {
      return reply.template('greeting', {message: 'hello world'})
    }
  }))
  test.setMiddleware([
    createTemplateMiddleware([{
      get (key) {
        return Promise.delay(50)
      }
    }, {
      get (key, req) {
        if (req.accept.type('json')) {
          return xs => ({name: key, context: xs})
        }

        return () => 'hi.'
      }
    }], [
      req => ({expression: 'surprise'})
    ])
  ])

  return test.request({
    url: '/',
    headers: {accept: 'text/html'}
  }).then(resp => {
    assert.deepEqual(resp.body.toString(), 'hi.')
  })
})

function test (name, runner) {
  tap.test(name, function named (assert) {
    test.controller = {}
    const server = http.createServer().listen(60880)
    const kserver = knork('anything', server, routes`
      * / target
    `(test.controller), [], {external: true})

    return kserver.then(srv => {
      test.setMiddleware = mw => {
        srv.middleware = mw
        srv.reverseMiddleware = mw.slice().reverse()
      }
      return runner(assert)
    }).then(() => {
      server.close()
      return kserver.get('closed')
    }, err => {
      server.close()
      return kserver.get('closed').then(() => {
        throw err
      })
    })
  })
}

test.setController = function (routes) {
  test.controller.target = routes
}

test.request = function (opts) {
  opts = opts || {}
  opts.url = `http://localhost:60880${opts.url || '/'}`
  opts.method = opts.method || 'GET'
  return Promise.promisify(request)(opts)
}
