'use strict'

const Promise = require('bluebird')
const request = require('request')
const cookie = require('cookie')
const http = require('http')
const tap = require('tap')

const routes = require('../routing')
const reply = require('../reply')
const knork = require('..')

test('reply.cookie: works as expected', assert => {
  test.setController(routes`
    GET / index
  `({
    index (req, context) {
      return reply.cookie(reply.cookie({
        message: 'hello world'
      }, 'cookie', 'monster'), 'godzilla', 'gidorah')
    }
  }))

  return test.request({json: true}).then(resp => {
    assert.equal(resp.statusCode, 200)
    assert.equal(resp.body.message, 'hello world')
    assert.ok('set-cookie' in resp.headers)
    assert.ok(Array.isArray(resp.headers['set-cookie']))

    const cookies = resp.headers['set-cookie'].map(cookie.parse)

    assert.deepEqual(cookies, [
      {cookie: 'monster', Path: '/', SameSite: 'Strict'},
      {godzilla: 'gidorah', Path: '/', SameSite: 'Strict'}
    ])
  })
})

test('reply.raw: passes through objects', assert => {
  test.setController(routes`
    GET / index
  `({
    index (req, context) {
      return reply.raw({message: 'hello world'})
    }
  }))

  return test.request({json: true}).then(resp => {
    assert.equal(resp.statusCode, 200)
    assert.equal(resp.body.message, 'hello world')
  })
})

test('reply.redirect: single arg redirect', assert => {
  test.setController(routes`
    GET /     index
  `({
    index (req, context) {
      return reply.redirect('/foo')
    }
  }))

  return test.request({followRedirect: false}).then(resp => {
    assert.equal(resp.statusCode, 302)
    assert.equal(String(resp.body), '')
    assert.equal(resp.headers.location, '/foo')
  })
})

test('reply.redirect: 2-arg redirect', assert => {
  test.setController(routes`
    GET /     index
  `({
    index (req, context) {
      return reply.redirect('hello world', '/foo')
    }
  }))

  return test.request({followRedirect: false}).then(resp => {
    assert.equal(resp.statusCode, 302)
    assert.equal(String(resp.body), 'hello world')
    assert.equal(resp.headers.location, '/foo')
  })
})

test('reply.redirect: 3-arg redirect', assert => {
  test.setController(routes`
    GET /     index
  `({
    index (req, context) {
      return reply.redirect('hello world', '/foo', 301)
    }
  }))

  return test.request({followRedirect: false}).then(resp => {
    assert.equal(resp.statusCode, 301)
    assert.equal(String(resp.body), 'hello world')
    assert.equal(resp.headers.location, '/foo')
  })
})

test('reply.link: set link header', assert => {
  test.setController(routes`
    GET /     index
  `({
    index (req, context) {
      return reply.link('hello world', 'stylesheet', '/gloo/bloo')
    }
  }))

  return test.request().then(resp => {
    assert.equal(resp.statusCode, 200)
    assert.equal(String(resp.body), 'hello world')
    assert.equal(resp.headers.link, '</gloo/bloo>; rel="stylesheet"')
  })
})

test('reply.link: set two link headers', assert => {
  test.setController(routes`
    GET /     index
  `({
    index (req, context) {
      return reply.link(reply.link(
        'hello world',
        'stylesheet',
        '/gloo/bloo'
      ), 'elsewhere', '/boo')
    }
  }))

  return test.request().then(resp => {
    assert.equal(resp.statusCode, 200)
    assert.equal(String(resp.body), 'hello world')
    assert.equal(
      resp.headers.link,
      '</gloo/bloo>; rel="stylesheet", </boo>; rel="elsewhere"'
    )
  })
})

test('reply.link: retrieve link', assert => {
  test.setController(routes`
    GET /     index
  `({
    index (req, context) {
      return reply.link(reply.link(
        false,
        'stylesheet',
        '/gloo/bloo'
      ))
    }
  }))

  return test.request({json: true}).then(resp => {
    assert.equal(resp.statusCode, 200)
    assert.deepEqual(resp.body, {stylesheet: {
      rel: 'stylesheet',
      url: '/gloo/bloo'
    }})
  })
})

test('reply.link: retrieve link by rel', assert => {
  test.setController(routes`
    GET /     index
  `({
    index (req, context) {
      return reply.link(reply.link(
        'hello world',
        'stylesheet',
        '/gloo/bloo'
      ), 'stylesheet')
    }
  }))

  return test.request({json: true}).then(resp => {
    assert.equal(resp.statusCode, 200)
    assert.deepEqual(resp.body, {
      rel: 'stylesheet',
      url: '/gloo/bloo'
    })
  })
})

function test (name, runner) {
  tap.test(name, function named (assert) {
    test.controller = {}
    const server = http.createServer().listen(60880)
    const kserver = knork('anything', server, routes`
      * / target
    `(test.controller), [], {external: true})

    return kserver.then(() => {
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
