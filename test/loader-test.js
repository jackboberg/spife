'use strict'

const Promise = require('bluebird')
const request = require('request')
const path = require('path')
const http = require('http')
const tap = require('tap')

const TemplateMiddleware = require('../middleware/template')
const Loader = require('../templates/loader')
const routes = require('../routing')
const reply = require('../reply')
const spife = require('..')

test('loader: loads templates', (assert, {createServer, request}) => {
  const loader = new Loader({
    basedir: '/',
    dirs: [path.join(__dirname, 'fixtures', 'template-dir')],
    load ({name, path}, request) {
      return require(path)
    },
    extension: '.js'
  })

  return createServer(routes`
    GET /one one
    GET /two two
  `({
    one (req, context) {
      return reply.template('one', {target: 'world'})
    },
    two (req, context) {
      return reply.template('two', {target: 'world'})
    }
  }), [
    new TemplateMiddleware([loader])
  ]).then(app => {
    return request({
      url: '/one'
    }).then(resp => {
      assert.equal(resp.body, 'hello world')
      return request({
        url: '/two'
      })
    }).then(resp => {
      assert.equal(resp.body, 'こんにちは world')
      app.server.close()
      return app.closed
    })
  })
})

test('loader: loads from cache', (assert, {createServer, request}) => {
  const loader = new Loader({
    basedir: '/',
    dirs: [path.join(__dirname, 'fixtures', 'template-dir')],
    load ({name, path}, request) {
      return require(path)
    },
    extension: '.js'
  })

  loader.cache.set('one', Promise.resolve({
    path: path.join(__dirname, 'fixtures', 'template-dir', 'two.js'),
    name: 'one'
  }))
  loader.templates = () => Promise.reject(new Error())

  return createServer(routes`
    GET / index
  `({
    index (req, context) {
      return reply.template('one', {target: 'world'})
    }
  }), [
    new TemplateMiddleware([loader])
  ]).then(app => {
    return request({
      url: '/'
    }).then(resp => {
      assert.equal(resp.body, 'こんにちは world')
      app.server.close()
      return app.closed
    })
  })
})

test('loader: on overlap, prefers first listed', (assert, {createServer, request}) => {
  const loader = new Loader({
    basedir: '/',
    dirs: [
      path.join(__dirname, 'fixtures', 'template-dir-2'),
      path.join(__dirname, 'fixtures', 'template-dir')
    ],
    load ({name, path}, request) {
      return require(path)
    },
    extension: '.js'
  })

  return createServer(routes`
    GET / index
  `({
    index (req, context) {
      return reply.template('two', {target: 'world'})
    }
  }), [
    new TemplateMiddleware([loader])
  ]).then(app => {
    return request({
      url: '/'
    }).then(resp => {
      assert.equal(resp.body, 'HI THERE')
      app.server.close()
      return app.closed
    })
  })
})

test('loader: failure throws distinct exception', assert => {
  const loader = new Loader({
    basedir: '/',
    dirs: [path.join(__dirname, 'fixtures', 'template-dir')],
    load ({name, path}, request) {
      return require(path)
    },
    extension: '.js'
  })

  return loader.get('dne', {}).catch(Loader.MissingTemplateError, () => {
    assert.ok('expected this error')
  })
})

test('loader: failing to enumerate templates leads to missing template error', assert => {
  const loader = new Loader({
    basedir: '/',
    dirs: [path.join(__dirname, 'fixtures', 'template-dir')],
    load ({name, path}, request) {
      return require(path)
    },
    extension: '.js'
  })
  loader.templates = () => Promise.reject(new Error('failure!'))
  return loader.get('it does not matter', {}).catch(Loader.MissingTemplateError, () => {
    assert.ok('expected this error')
  })
})

function test (what, how) {
  return tap.test(what, assert => {
    return Promise.try(() => how(assert, {
      createServer (urls, middleware) {
        const server = http.createServer().listen(60880)
        const spifeServer = spife('anything', server, urls, middleware, {isExternal: false})
        return spifeServer
      },
      request (opts) {
        opts = opts || {}
        opts.url = `http://localhost:60880${opts.url || '/'}`
        opts.method = opts.method || 'GET'
        return Promise.promisify(request)(opts)
      }
    }))
  })
}
