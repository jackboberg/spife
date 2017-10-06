'use strict'

const Promise = require('bluebird')
const request = require('request')
const http = require('http')
const tap = require('tap')

const createTemplateMiddleware = require('../middleware/template')
const serializer = require('../templates/serializer')
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

test('reply.template returns context on json', assert => {
  class ABC {
    constructor (a, b) {
      this.a = a
      this.b = b
    }
  }

  serializer.define(ABC.prototype, abc => {
    return {x: abc.a, y: abc.b}
  })

  test.setController(routes`
    GET / index
  `({
    index (req, context) {
      return reply.template('greeting', {
        foo: new ABC({hello: 'world'}, new ABC(1, null)),
        array: [1, 3, 4],
        array2: [1, 12, new ABC(NaN, new Date())]
      })
    }
  }))
  let sawContext = null
  test.setMiddleware([
    createTemplateMiddleware([{
      get (key, req) {
        return context => {
          sawContext = context
          return 'hi'
        }
      }
    }])
  ])

  return test.request({
    url: '/',
    json: true
  }).then(resp => {
    console.log(sawContext)
    console.log(resp.body)
  })
})

test('reply.template explodes on circular serialization', assert => {
  class ABC {
    constructor (a, b) {
      this.a = a
      this.b = b
    }
  }

  serializer.define(ABC.prototype, abc => {
    return {x: abc.a, y: abc.b}
  })

  test.setController(routes`
    GET / index
  `({
    index (req, context) {
      const abc = new ABC({
        foo: new ABC({hello: 'world'}, new ABC(1, null)),
        array: [1, 3, 4],
        array2: [1, 12, new ABC(NaN, new Date())]
      }, null)
      abc.a.foo.b = abc
      return reply.template('greeting', abc)
    }
  }))
  let sawContext = null
  test.setMiddleware([
    createTemplateMiddleware([{
      get (key, req) {
        return context => {
          sawContext = context
          return 'hi'
        }
      }
    }])
  ])

  return test.request({
    url: '/',
    json: true
  }).then(resp => {
    console.log(sawContext)
    console.log(resp.body)
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
