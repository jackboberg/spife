'use strict'

const Promise = require('bluebird')
const request = require('request')
const cookie = require('cookie')
const http = require('http')
const tap = require('tap')

const CSRFMiddleware = require('../middleware/csrf')
const routes = require('../routing')
const knork = require('..')

test('csrf: get url sets csrftoken', assert => {
  return test.request().then(resp => {
    const parsed = cookie.parse(resp.headers['set-cookie'][0])
    assert.ok('crumb' in parsed)
    assert.equal(parsed.crumb.length, 30)
  })
})

test('csrf: get -> post works', assert => {
  return test.request().then(resp => {
    const parsed = cookie.parse(resp.headers['set-cookie'][0])

    return test.request({
      method: 'POST',
      headers: {cookie: `crumb=${parsed.crumb}`},
      form: {crumb: parsed.crumb}
    })
  }).then(resp => {
    assert.equal(resp.statusCode, 200)
  })
})

test('csrf: post sans crumb fails', assert => {
  return test.request().then(resp => {
    const parsed = cookie.parse(resp.headers['set-cookie'][0])

    return test.request({
      method: 'POST',
      headers: {cookie: `crumb=${parsed.crumb}`},
      form: {nothing: 'whatever'}
    })
  }).then(resp => {
    assert.equal(resp.statusCode, 403)
  })
})

test('csrf: post with invalid crumb fails', assert => {
  return test.request().then(resp => {
    const parsed = cookie.parse(resp.headers['set-cookie'][0])

    return test.request({
      method: 'POST',
      headers: {cookie: `crumb=${parsed.crumb}`},
      form: {crumb: 'hah, nope', nothing: 'whatever'}
    })
  }).then(resp => {
    assert.equal(resp.statusCode, 403)
  })
})

test('csrf: post without crumb on exempt handler succeeds', assert => {
  return test.request({
    method: 'POST',
    url: '/csrf-exempt',
    form: {nothing: 'whatever'}
  }).then(resp => {
    assert.equal(resp.statusCode, 200)
  })
})

test('csrf: get -> post rotates on csrf-refresh', assert => {
  return test.request().then(resp => {
    const parsed = cookie.parse(resp.headers['set-cookie'][0])

    return test.request({
      method: 'POST',
      url: '/csrf-refresh',
      headers: {cookie: `crumb=${parsed.crumb}`},
      form: {crumb: parsed.crumb}
    }).then(resp => {
      assert.equal(resp.statusCode, 200)

      const second = cookie.parse(resp.headers['set-cookie'][0])
      assert.notEqual(second.crumb, parsed.crumb)
    })
  })
})

test('csrf: restful routes require header (body fails)', assert => {
  return test.request().then(resp => {
    const parsed = cookie.parse(resp.headers['set-cookie'][0])

    return test.request({
      url: '/rest',
      method: 'POST',
      headers: {cookie: `crumb=${parsed.crumb}`},
      form: {crumb: parsed.crumb}
    })
  }).then(resp => {
    assert.equal(resp.statusCode, 403)
  })
})

test('csrf: restful routes require header (success)', assert => {
  return test.request().then(resp => {
    const parsed = cookie.parse(resp.headers['set-cookie'][0])

    return test.request({
      url: '/rest',
      method: 'POST',
      headers: {
        cookie: `crumb=${parsed.crumb}`,
        'csrf-header': parsed.crumb
      }
    })
  }).then(resp => {
    assert.equal(resp.statusCode, 200)
  })
})

function test (name, runner) {
  runner = runner || (() => {})
  tap.test(name, function named (assert) {
    test.controller = {}
    const server = http.createServer().listen(60880)
    const kserver = knork('anything', server, routes`
      * /csrf-exempt    exempt
      * /csrf-refresh   refresh
      * /rest           restful
      * /               target
    `({
      exempt: Object.assign((req, context) => {
        return req.method
      }, {csrfExempt: true}),
      refresh: Object.assign((req, context) => {
        return req.method
      }, {resetCSRF: true}),
      restful: Object.assign((req, context) => {
        return req.method
      }, {restful: true}),
      target (req, context) {
        return req.method
      }
    }), [CSRFMiddleware({
      headerName: 'csrf-header',
      cookieName: 'crumb',
      payloadName: 'crumb',
      size: 30
    })], {enableFormParsing: true})

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

test.request = function (opts) {
  opts = opts || {}
  opts.url = `http://localhost:60880${opts.url || '/'}`
  opts.method = opts.method || 'GET'
  return Promise.promisify(request)(opts)
}
