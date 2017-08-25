'use strict'

const Promise = require('bluebird')
const request = require('request')
const crypto = require('crypto')
const http = require('http')
const tap = require('tap')
const url = require('url')

const bodyLimit = require('../middleware/body-limit')
const bodyJson = require('../middleware/body-json')

const routes = require('../routing')
const knork = require('..')

test('request.body: fail when body not parseable', assert => {
  test.setController(routes`
    POST / index
  `({
    index (req, context) {
      return req.body.then(body => {
        return 'foo'
      })
    }
  }))

  return test.request({
    method: 'POST',
    body: '{bad: cake'
  }).then(resp => {
    assert.equal(resp.statusCode, 400)
  })
})

test('request.body: default fallback parser is json', assert => {
  test.setController(routes`
    POST / index
  `({
    index (req, context) {
      return req.body.then(body => {
        return 'foo'
      })
    }
  }))

  return test.request({
    method: 'POST',
    body: '{"bad": "cake"}',
    json: false
  }).then(resp => {
    assert.equal(resp.body, 'foo')
    assert.equal(resp.statusCode, 200)
  })
})

test('request.id: use request-id (isExternal = false)', assert => {
  test.setController(routes`
    GET / index
  `({
    index (req, context) {
      return req.id
    }
  }))

  return test.request({headers: {
    'request-id': 'expected'
  }}).then(resp => {
    assert.equal(resp.statusCode, 200)
    assert.equal(resp.body, 'expected')
  })
}, {isExternal: false})

test('request.id: gen from request-id (isExternal = true)', assert => {
  test.setController(routes`
    GET / index
  `({
    index (req, context) {
      return req.id
    }
  }))

  return test.request({headers: {
    'request-id': 'expected'
  }}).then(resp => {
    assert.equal(resp.statusCode, 200)
    assert.equal(
      resp.body.split('-')[0],
      crypto.createHash('sha1').update('expected').digest('base64')
    )
  })
}, {isExternal: true})

test('request.id: generate new id when request-id not present', assert => {
  test.setController(routes`
    GET / index
  `({
    index (req, context) {
      return req.id
    }
  }))

  return test.request().then(resp => {
    assert.equal(resp.statusCode, 200)
    const buf = Buffer.from(resp.body, 'base64')
    assert.equal(buf.length, 16)
  })
})

test('request.cookies(): return null on no cookie header', assert => {
  test.setController(routes`
    GET / index
  `({
    index (req, context) {
      return {result: req.cookies()}
    }
  }))

  return test.request({json: true}).then(resp => {
    assert.equal(resp.statusCode, 200)
    assert.deepEqual(resp.body, {result: null})
  })
})

test('request.cookies(): return cookie object', assert => {
  test.setController(routes`
    GET / index
  `({
    index (req, context) {
      return {result: req.cookies()}
    }
  }))

  return test.request({
    json: true,
    headers: {cookie: 'hello=world; foo=bar'}
  }).then(resp => {
    assert.equal(resp.statusCode, 200)
    assert.deepEqual(resp.body, {result: {
      hello: 'world',
      foo: 'bar'
    }})
  })
})

test('request.cookie(): return null on no cookie header', assert => {
  test.setController(routes`
    GET / index
  `({
    index (req, context) {
      return {result: req.cookie('anything')}
    }
  }))

  return test.request({json: true}).then(resp => {
    assert.equal(resp.statusCode, 200)
    assert.deepEqual(resp.body, {result: null})
  })
})

test('request.cookie(): return null on no cookie by name', assert => {
  test.setController(routes`
    GET / index
  `({
    index (req, context) {
      return {result: req.cookie('dne')}
    }
  }))

  return test.request({
    json: true,
    headers: {cookie: 'hello=world; foo=bar'}
  }).then(resp => {
    assert.equal(resp.statusCode, 200)
    assert.deepEqual(resp.body, {result: null})
  })
})

test('request.cookie(): return cookie', assert => {
  test.setController(routes`
    GET / index
  `({
    index (req, context) {
      return {result: req.cookie('foo')}
    }
  }))

  return test.request({
    json: true,
    headers: {cookie: 'hello=world; foo=bar'}
  }).then(resp => {
    assert.equal(resp.statusCode, 200)
    assert.deepEqual(resp.body, {result: 'bar'})
  })
})

test('request.cookie(): return cookie (multi, array)', assert => {
  test.setController(routes`
    GET / index
  `({
    index (req, context) {
      return {result: req.cookie('foo')}
    }
  }))

  return test.request({
    json: true,
    headers: {cookie: ['hello=world', 'foo=bar']}
  }).then(resp => {
    assert.equal(resp.statusCode, 200)
    assert.deepEqual(resp.body, {result: 'bar'})
  })
})

test('request.cookie(): return cookie (multi, string w/comma)', assert => {
  test.setController(routes`
    GET / index
  `({
    index (req, context) {
      return {result: req.cookie('foo')}
    }
  }))

  return test.request({
    json: true,
    headers: {cookie: ['hello=world, foo=bar']}
  }).then(resp => {
    assert.equal(resp.statusCode, 200)
    assert.deepEqual(resp.body, {result: 'bar'})
  })
})

test('request.body: fail on previous raw access', assert => {
  test.setController(routes`
    GET / index
  `({
    index (req, context) {
      (() => {})(req.raw)
      return req.body.then(() => {
        return 'foo'
      })
    }
  }))

  return test.request({
    json: true,
    headers: {cookie: 'hello=world; foo=bar'}
  }).then(resp => {
    assert.equal(resp.statusCode, 500)
    assert.ok('message' in resp.body)
    assert.equal(
      resp.body.message,
      'Cannot read the body if "raw" has been accessed.'
    )
  })
})

test('request.body: fail when body too large', assert => {
  test.setController(routes`
    POST / index
  `({
    index (req, context) {
      return req.body.then(() => {
        return 'foo'
      })
    }
  }))

  return test.request({
    method: 'POST',
    json: true,
    body: 'oh no'.repeat(30)
  }).then(resp => {
    assert.equal(resp.statusCode, 413)
  })
}, {maxBodySize: 10})

test('request.body: resolve to null on empty body', assert => {
  test.setController(routes`
    POST / index
  `({
    index (req, context) {
      return req.body.then(body => {
        assert.equal(body, null)
        return 'foo'
      })
    }
  }))

  return test.request({
    method: 'POST'
  }).then(resp => {
    assert.equal(resp.statusCode, 200)
  })
})

test('request.body: parse json', assert => {
  test.setController(routes`
    POST / index
  `({
    index (req, context) {
      return req.body.then(body => {
        return body.value
      })
    }
  }))

  return test.request({
    method: 'POST',
    json: true,
    body: {value: {message: 'there and back again'}}
  }).then(resp => {
    assert.equal(resp.statusCode, 200)
    assert.deepEqual(resp.body, {
      message: 'there and back again'
    })
  })
})

test('request.headers: return header object', assert => {
  test.setController(routes`
    GET / index
  `({
    index (req, context) {
      assert.deepEqual(req.headers, req.raw.headers)
    }
  }))

  return test.request().then(resp => {
    assert.equal(resp.statusCode, 204)
  })
})

test('request.rawHeaders: return raw headers', assert => {
  test.setController(routes`
    GET / index
  `({
    index (req, context) {
      assert.deepEqual(req.rawHeaders, req.raw.rawHeaders)
    }
  }))

  return test.request().then(resp => {
    assert.equal(resp.statusCode, 204)
  })
})

test('request.url: return url', assert => {
  test.setController(routes`
    GET / index
  `({
    index (req, context) {
      assert.deepEqual(req.url, req.raw.url)
    }
  }))

  return test.request().then(resp => {
    assert.equal(resp.statusCode, 204)
  })
})

test('request.urlObject: return parsed url', assert => {
  test.setController(routes`
    GET /hello index
  `({
    index (req, context) {
      assert.deepEqual(req.urlObject, url.parse(req.raw.url, true))
    }
  }))

  return test.request({url: '/hello?q=3&b=4'}).then(resp => {
    assert.equal(resp.statusCode, 204)
  })
})

test('request.query: return query object', assert => {
  test.setController(routes`
    GET /hello index
  `({
    index (req, context) {
      return req.query
    }
  }))

  return test.request({json: true, url: '/hello?q=3&b=4'}).then(resp => {
    assert.deepEqual(resp.body, {
      q: 3,
      b: 4
    })
  })
})

test('request.getRanges(size): return ranges object', assert => {
  test.setController(routes`
    GET / index
  `({
    index (req, context) {
      return req.getRanges()
    }
  }))

  return test.request({
    json: true,
    headers: {
      'ranges': 'bytes=0-10,60-66'
    }
  }).then(resp => {
    assert.deepEqual(resp.body, [
      {start: 0, end: 10},
      {start: 60, end: 66}
    ])
  })
})

test('request.accept: return accepts object', assert => {
  test.setController(routes`
    GET / index
  `({
    index (req, context) {
      return req.accept.types([
        'image/png',
        'application/xml',
        'application/json'
      ])
    }
  }))

  return test.request({
    json: true,
    headers: {
      'accept': 'application/xml; q=0.9, application/json; q=1.0'
    }
  }).then(resp => {
    assert.equal(resp.body, 'application/json')
  })
})

test('request.remote*: has remoteFamily, remoteAddress, and remotePort', assert => {
  test.setController(routes`
    GET / index
  `({
    index (req, context) {
      return {
        remoteAddress: req.remoteAddress,
        remoteFamily: req.remoteFamily,
        remotePort: req.remotePort
      }
    }
  }))

  return test.request({
    json: true
  }).then(resp => {
    assert.ok(resp.body.remoteAddress.length)
    assert.equal(resp.body.remoteFamily.slice(0, 3), 'IPv')
    assert.equal(typeof resp.body.remotePort, 'number')
  })
})


test('request.router: allows overriding routes mid-request', assert => {
  test.setController(routes`
    GET / index
  `({
    index (req, context) {
      return 'hello world'
    }
  }))

  test.setMiddleware((req, next) => {
    req.router = routes`
      GET / foo
    `({
      foo (req, context) {
        return 'no way'
      }
    })
    return next()
  })

  return test.request({
    json: true
  }).then(resp => {
    assert.equal(resp.body, 'no way')
  })
})

function test (name, runner, opts) {
  runner = runner || (() => {})
  tap.test(name, function named (assert) {
    test.controller = {}
    test.middleware = (req, next) => next()
    const server = http.createServer().listen(60880)
    const kserver = knork('anything', server, routes`
      * / target
    `(test.controller), [
      bodyLimit({max: (opts || {}).maxBodySize || 2048}),
      bodyJson(),
      function processRequest (req, next) {
        return test.middleware(req, next)
      }
    ], opts || {isExternal: true})

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

test.setMiddleware = function (processRequest) {
  test.middleware = processRequest
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
