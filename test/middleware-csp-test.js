'use strict'

const Promise = require('bluebird')
const request = require('request')
const http = require('http')
const tap = require('tap')

const CspMiddleware = require('../middleware/csp')
const routes = require('../routing')
const spife = require('..')

test('csp: sets header', assert => {
  return test.request().then(resp => {
    assert.ok(resp.headers['content-security-policy'].match(/connect-src 'self' https/))
  })
},
  {
    settings: {
      'connect-src': [
        'self',
        'https://typeahead.npmjs.com/'
      ]
    }
  }
)

test('csp: surrounds keywords with \'', assert => {
  return test.request().then(resp => {
    const csp = resp.headers['content-security-policy']
    assert.ok(csp.match(/'self'/))
    assert.ok(!csp.match(/ self /))
    assert.ok(csp.match(/'none'/))
    assert.ok(!csp.match(/ none /))
    assert.ok(csp.match(/'unsafe-inline'/))
    assert.ok(!csp.match(/ unsafe-inline /))
    assert.ok(csp.match(/'unsafe-eval'/))
    assert.ok(!csp.match(/ unsafe-eval/))
  })
},
  {
    settings: {
      'connect-src': [
        'self',
        'https://typeahead.npmjs.com/',
        'https://partners.npmjs.com/',
        'https://checkout.stripe.com/api/outer/manhattan',
        'https://api.github.com',
        'https://ac.cnstrc.com',
        'https://*.log.optimizely.com'
      ],
      'default-src': '*',
      'frame-ancestors': 'none',
      'img-src': ['*', 'data:'],
      'script-src': ['*', 'unsafe-eval', 'unsafe-inline', 'safari-extension:'],
      'style-src': ['*', 'unsafe-inline'],
      'report-uri': '/-/csplog'
    }
  }
)

test('csp: sets report only header', assert => {
  return test.request().then(resp => {
    assert.ok(resp.headers['content-security-policy-report-only'].match(/connect-src 'self' https/))
  })
},
  {
    settings: {
      'connect-src': [
        'self',
        'https://typeahead.npmjs.com/'
      ]
    },
    options: {
      reportOnly: true
    }
  }
)

test.request = function (opts) {
  opts = opts || {}
  opts.url = `http://localhost:60880${opts.url || '/'}`
  opts.method = opts.method || 'GET'
  return Promise.promisify(request)(opts)
}

function test (name, runner, middlewareSettings) {
  runner = runner || (() => {})
  tap.test(name, function named (assert) {
    test.controller = {}
    const server = http.createServer().listen(60880)
    const spifeServer = spife('anything', server, routes`
      * /               target
    `({
      target (req, context) {
        return req.method
      }
    }),
      [
        CspMiddleware(middlewareSettings.settings, middlewareSettings.options)
      ])

    return spifeServer.then(() => {
      return runner(assert)
    }).then(() => {
      server.close()
      return spifeServer.get('closed')
    }, err => {
      server.close()
      return spifeServer.get('closed').then(() => {
        throw err
      })
    })
  })
}
