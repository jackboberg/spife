'use strict'

const Readable = require('stream').Readable
const Promise = require('bluebird')
const test = require('tap').test
const EE = require('events')
const http = require('http')
const net = require('net')
const fs = require('fs')

const routing = require('../routing')
const reply = require('../reply')
const knork = require('..')

const Emitter = require('numbat-emitter')

// no retries, please.
Emitter.prototype.maxretries = 0

process.env.DEBUG = ''
process.env.METRICS = ''

test('bad maxBodySize throws error on NaN', assert => {
  try {
    knork('anything', {}, null, [], {maxBodySize: 'string'})
  } catch (err) {
    assert.ok(/maxBodySize/.test(err.message))
    return assert.end()
  }
  assert.fail('should have thrown')
  assert.end()
})

test('bad maxBodySize throws error on <0', assert => {
  try {
    knork('anything', {}, null, [], {maxBodySize: -1})
  } catch (err) {
    assert.ok(/maxBodySize/.test(err.message))
    return assert.end()
  }
  assert.fail('should have thrown')
  assert.end()
})

test('server promise resolves once http server listening', assert => Promise.try(() => {
  const ee = new EE()
  var resolve = null
  var reject = null
  const promise = new Promise((_resolve, _reject) => {
    resolve = _resolve
    reject = _reject
  })
  const timeout = setTimeout(() => {
    reject(new Error('did not resolve server on listening'))
  }, 50)
  knork('anything', ee, null, []).then(server => {
    clearTimeout(timeout)
    resolve()
  })
  ee.emit('listening')
  return promise
}))

test('http server listening triggers mw installs', assert => Promise.try(() => {
  const ee = new EE()
  const list = []
  const mw = [
    {install (knork) { list.push({knork, name: '1'}) }},
    {install (knork) {
      return Promise.delay(10).then(() => {
        list.push({knork, name: '2'})
      })
    }},
    {},
    {install (knork) {
      list.push({knork, name: '3'})
    }}
  ]
  const onServer = knork('anything', ee, null, mw).then(server => {
    list.forEach(xs => assert.equal(xs.knork, server))
    assert.equal(list.length, 3)
    assert.deepEqual(list.map(xs => xs.name), ['1', '2', '3'])
  })
  ee.emit('listening')
  return onServer
}))

test('closing http server uninstalls mw', assert => Promise.try(() => {
  const ee = new EE()
  const list = []
  const mw = [
    {onServerClose (knork) { list.push('1') }},
    {onServerClose (knork) {
      return Promise.delay(10).then(() => {
        list.push('2')
      })
    }},
    {},
    {onServerClose () {
      list.push('3')
    }}
  ]
  const onServer = knork('anything', ee, null, mw)

  onServer.then(server => {
    ee.emit('close')
  })
  ee.emit('listening')
  return onServer.get('closed').then(() => {
    assert.deepEqual(list, ['3', '2', '1'])
  })
}))

test('closing mid-install mw runs install to completion', assert => Promise.try(() => {
  const ee = new EE()
  const list = []
  const mw = [{
    install () {
      list.push('1')
    },
    onServerClose () {
      list.push('1')
    }
  }, {
    install () {
      ee.emit('close') // <---------- close as part of startup!
      return Promise.delay(10).then(() => {
        list.push('2')
      })
    },
    onServerClose () {
      return Promise.delay(10).then(() => {
        list.push('2')
      })
    }
  }, {
  }, {
    install () { list.push('3') },
    onServerClose () { list.push('3') }
  }]
  const onServer = knork('anything', ee, null, mw)
  ee.emit('listening')
  return onServer.get('closed').then(() => {
    assert.deepEqual(list, ['1', '2', '3', '3', '2', '1'])
  })
}))

test('server metrics option as object sets metrics', assert => Promise.try(() => {
  const server = http.createServer().listen(60880)
  const expect = {}
  const kserver = knork('anything', server, routing`
    GET / view
  `({
    view (req) {
      return 'ok'
    }
  }), [], {metrics: expect})

  kserver.then(knork => {
    assert.equal(knork.metrics, expect)
    server.close()
  })
  return kserver.get('closed')
}))

test('create metrics: string', assert => Promise.try(() => {
  const server = http.createServer().listen(60880)
  const metricsServer = net.createServer().listen(60881)
  const kserver = knork('anything', server, routing`
    GET / view
  `({
    view (req) {
      return 'ok'
    }
  }), [], {metrics: 'tcp://localhost:60881'})

  const timeout = setTimeout(() => {
    assert.fail('timed out')
    metricsServer.close()
    server.close()
  }, 200)

  metricsServer.on('connection', conn => {
    clearTimeout(timeout)
    conn.end()
    metricsServer.close(function () {
      server.close()
    })
  })

  return kserver.get('closed')
}))

test('create metrics: envvar', assert => Promise.try(() => {
  const server = http.createServer().listen(60880)
  const metricsServer = net.createServer().listen(60881)
  process.env.METRICS = 'tcp://localhost:60881'
  const kserver = knork('anything', server, routing`
    GET / view
  `({
    view (req) {
      return 'ok'
    }
  }), [])

  const timeout = setTimeout(() => {
    assert.fail('timed out')
    metricsServer.close()
    server.close()
  }, 200)

  metricsServer.on('connection', conn => {
    clearTimeout(timeout)
    process.env.METRICS = ''
    conn.end()
    metricsServer.close(function () {
      server.close()
    })
  })

  return kserver.get('closed')
}))

test('bad client', assert => Promise.try(() => {
  const server = http.createServer().listen(60880)
  const kserver = knork('anything', server, routing`
    GET / view
  `({
    view (req) {
      return reply('hello!', 200, {
        [req.query.p]: 'OK'
      })
    }
  }), [], {
    onclienterror (exc, sock) {
      clearTimeout(timeout)
      assert.equal(exc.code, 'HPE_INVALID_METHOD')
      server.close()
    }
  })

  const timeout = setTimeout(() => {
    assert.fail('timed out')
    server.close()
  }, 200)

  const conn = net.connect(60880)
  conn.on('data', data => {
    assert.fail('should not receive data')
    server.close()
  })
  conn.end(`GEM / HTTP/1.1
Host: localhost:60880
Connection: close\r\n\r\n`)

  return kserver.get('closed')
}))

test('client disconnect', assert => Promise.try(() => {
  const server = http.createServer().listen(60880)
  const list = []
  const kserver = knork('anything', server, routing`
    GET / view
  `({
    view (req) {
      return fs.createReadStream(__filename)
        .on('close', () => {
          list.push('closed')
        })
    }
  }), [], {})

  server.on('response-error', err => {
    clearTimeout(timeout)
    list.push('response-error')
    server.close()
  })

  const timeout = setTimeout(() => {
    assert.fail('timed out')
    server.close()
  }, 200)

  const conn = net.connect(60880)
  conn.on('data', data => {
    conn.destroy()
  })
  conn.end(`GET / HTTP/1.1
Host: localhost:60880
Connection: close\r\n\r\n`)
  return kserver.get('closed').then(() => {
    assert.deepEqual(list, ['closed', 'response-error'])
  })
}))

test('returning nothing from request mw runs view', assert => Promise.try(() => {
  const server = http.createServer().listen(60880)
  const list = []
  const mw = [{
    processRequest (req) {
      list.push('1')
    }
  }]
  const kserver = knork('anything', server, routing`
    GET / view
  `({
    view (req) {
      list.push('2')
      return 'ok'
    }
  }), mw)

  http.get({method: 'GET', port: 60880}, res => {
    res.on('data', data => {
      assert.equal(data + '', 'ok')
      assert.equal(list.length, 2)
      assert.deepEqual(list, ['1', '2'])
      server.close()
    })
  })

  return kserver.get('closed')
}))

test('returning value from request mw returns request', assert => Promise.try(() => {
  const server = http.createServer().listen(60880)
  const list = []
  const mw = [{
    processRequest (req) {
      list.push('1')
      return 'haha'
    }
  }]
  const kserver = knork('anything', server, routing`
    GET / view
  `({
    view (req) {
      list.push('2')
      return 'ok'
    }
  }), mw)

  http.get({method: 'GET', port: 60880}, res => {
    res.on('data', data => {
      assert.equal(data + '', 'haha')
      assert.equal(list.length, 1)
      assert.deepEqual(list, ['1'])
      server.close()
    })
  })

  return kserver.get('closed')
}))

test('response mw sees response from request mw', assert => Promise.try(() => {
  const server = http.createServer().listen(60880)
  const list = []
  const mw = [{
    processRequest (req) {
      list.push('1')
      return {message: 'hello'}
    },
    processResponse (req, resp) {
      list.push(resp.message)
    }
  }]
  const kserver = knork('anything', server, routing`
    GET / view
  `({
    view (req) {
      list.push('2')
      return 'ok'
    }
  }), mw)

  http.get({method: 'GET', port: 60880}, res => {
    res.on('data', data => {
      assert.equal(data + '', '{"message":"hello"}')
      assert.equal(list.length, 2)
      assert.deepEqual(list, ['1', 'hello'])
      server.close()
    })
  })

  return kserver.get('closed')
}))

test('response mw sees response from view mw', assert => Promise.try(() => {
  const server = http.createServer().listen(60880)
  const list = []
  const mw = [{
    processRequest (req) {
      list.push('1')
    },
    processView (req, match, context) {
      list.push('2')
      return {message: 'hello'}
    },
    processResponse (req, resp) {
      list.push(resp.message)
    }
  }]
  const kserver = knork('anything', server, routing`
    GET / view
  `({
    view (req) {
      list.push('3')
      return 'ok'
    }
  }), mw)

  http.get({method: 'GET', port: 60880}, res => {
    res.on('data', data => {
      assert.equal(data + '', '{"message":"hello"}')
      assert.equal(list.length, 3)
      assert.deepEqual(list, ['1', '2', 'hello'])
      server.close()
    })
  })

  return kserver.get('closed')
}))

test('response mw does not see response from response mw', assert => Promise.try(() => {
  const server = http.createServer().listen(60880)
  const list = []
  const mw = [{
    processRequest (req) {
      list.push('1')
      return {message: 'hello'}
    },
    processResponse (req, resp) {
      list.push('3')
    }
  }, {
    processResponse (req, resp) {
      return 'banana'
    }
  }]
  const kserver = knork('anything', server, routing`
    GET / view
  `({
    view (req) {
      list.push('2')
      return 'ok'
    }
  }), mw)

  http.get({method: 'GET', port: 60880}, res => {
    res.on('data', data => {
      assert.equal(data + '', 'banana')
      assert.equal(list.length, 1)
      assert.deepEqual(list, ['1'])
      server.close()
    })
  })

  return kserver.get('closed')
}))

test('view mw response skips view', assert => Promise.try(() => {
  const server = http.createServer().listen(60880)
  const list = []
  const mw = [{
    processView (req) {
      list.push('1')
      return {message: 'hello'}
    }
  }]
  const kserver = knork('anything', server, routing`
    GET / view
  `({
    view (req) {
      list.push('2')
      return 'ok'
    }
  }), mw)

  http.get({method: 'GET', port: 60880}, res => {
    res.on('data', data => {
      assert.equal(data + '', '{"message":"hello"}')
      assert.equal(list.length, 1)
      assert.deepEqual(list, ['1'])
      server.close()
    })
  })

  return kserver.get('closed')
}))

test('view mw error skips view', assert => Promise.try(() => {
  const server = http.createServer().listen(60880)
  const list = []
  const mw = [{
    processView (req) {
      throw new Error('what')
    }
  }]
  const kserver = knork('anything', server, routing`
    GET / view
  `({
    view (req) {
      list.push('2')
      return 'ok'
    }
  }), mw)

  http.get({method: 'GET', port: 60880}, res => {
    res.on('data', data => {
      assert.equal(res.statusCode, 500)
      assert.equal(data + '', '{"message":"what"}')
      assert.equal(list.length, 0)
      server.close()
    })
  })

  return kserver.get('closed')
}))

test('not implemented works', assert => Promise.try(() => {
  const server = http.createServer().listen(60880)
  const list = []
  const mw = [{
    processView (req) {
      throw new Error('what')
    }
  }]
  const kserver = knork('anything', server, routing`
    GET / view
  `({}), mw)

  http.get({method: 'GET', port: 60880}, res => {
    res.on('data', data => {
      assert.equal(res.statusCode, 501)
      assert.equal(data + '', '{"message":"\\\"GET /\\\" is not implemented."}')
      assert.equal(list.length, 0)
      server.close()
    })
  })

  return kserver.get('closed')
}))

test('not found works', assert => Promise.try(() => {
  const server = http.createServer().listen(60880)
  const list = []
  const mw = [{
    processView (req) {
      throw new Error('what')
    }
  }]
  const kserver = knork('anything', server, routing`
    GET / view
  `({
    view (req) {
      return 'hi there!'
    }
  }), mw)

  http.get({method: 'GET', path: '/asdf', port: 60880}, res => {
    res.on('data', data => {
      assert.equal(res.statusCode, 404)
      assert.equal(data + '', '{"message":"Not Found"}')
      assert.equal(list.length, 0)
      server.close()
    })
  })

  return kserver.get('closed')
}))

test('error mw: no response', assert => Promise.try(() => {
  const server = http.createServer().listen(60880)
  const list = []
  const mw = [{
    processError (req) {
      list.push('1')
    }
  }, {
    processError (req, err) {
      list.push('2')
      reply.status(err, 418)
    }
  }]
  const kserver = knork('anything', server, routing`
    GET / view
  `({
    view (req) {
      throw new Error('oh no!')
    }
  }), mw)

  http.get({method: 'GET', path: '/', port: 60880}, res => {
    const acc = []
    res.on('data', data => {
      acc.push(data)
    })
    res.once('end', () => {
      assert.equal(res.statusCode, 418)
      assert.equal(
        Buffer.concat(acc).toString(),
        '{"message":"oh no!"}'
      )
      assert.deepEqual(list, ['2', '1'])
      server.close()
    })
  })

  return kserver.get('closed')
}))

test('error mw: response', assert => Promise.try(() => {
  const server = http.createServer().listen(60880)
  const mw = [{
    processError (req, err) {
      return 'we should not be called since the next one returns'
    }
  }, {
    processError (req, err) {
      return 'whaaaaat. we are fine here.'
    }
  }]
  const kserver = knork('anything', server, routing`
    GET / view
  `({
    view (req) {
      return Promise.delay(10).then(() => {
        throw new Error('oh no!')
      })
    }
  }), mw)

  http.get({method: 'GET', path: '/', port: 60880}, res => {
    const acc = []
    res.on('data', data => {
      acc.push(data)
    })
    res.once('end', () => {
      assert.equal(res.statusCode, 200)
      assert.equal(
        res.headers['content-type'],
        'text/plain; charset=utf-8'
      )
      assert.equal(
        Buffer.concat(acc).toString(),
        'whaaaaat. we are fine here.'
      )
      server.close()
    })
  })

  return kserver.get('closed')
}))

test('error mw: throw', assert => Promise.try(() => {
  const server = http.createServer().listen(60880)
  const mw = [{
    processError (req, err) {
      return 'we should not be called since the next one throws'
    }
  }, {
    processError (req, err) {
      throw new Error('SURPRISE')
    }
  }]
  const kserver = knork('anything', server, routing`
    GET / view
  `({
    view (req) {
      return Promise.delay(10).then(() => {
        throw new Error('oh no!')
      })
    }
  }), mw)

  http.get({method: 'GET', path: '/', port: 60880}, res => {
    const acc = []
    res.on('data', data => {
      acc.push(data)
    })
    res.once('end', () => {
      assert.equal(res.statusCode, 500)
      assert.equal(
        Buffer.concat(acc).toString(),
        '{"message":"SURPRISE"}'
      )
      server.close()
    })
  })

  return kserver.get('closed')
}))

test('error mw: rejection', assert => Promise.try(() => {
  const server = http.createServer().listen(60880)
  const mw = [{
    processError (req, err) {
      return 'we should not be called since the next one throws'
    }
  }, {
    processError (req, err) {
      return Promise.delay(10).then(() => {
        throw new Error('SURPRISE')
      })
    }
  }]
  const kserver = knork('anything', server, routing`
    GET / view
  `({
    view (req) {
      throw new Error('oh no!')
    }
  }), mw)

  http.get({method: 'GET', path: '/', port: 60880}, res => {
    const acc = []
    res.on('data', data => {
      acc.push(data)
    })
    res.once('end', () => {
      assert.equal(res.statusCode, 500)
      assert.equal(
        Buffer.concat(acc).toString(),
        '{"message":"SURPRISE"}'
      )
      server.close()
    })
  })

  return kserver.get('closed')
}))

test('returning stream works', assert => Promise.try(() => {
  const server = http.createServer().listen(60880)
  const kserver = knork('anything', server, routing`
    GET / view
  `({
    view (req) {
      return fs.createReadStream(__filename)
    }
  }))

  http.get({method: 'GET', path: '/', port: 60880}, res => {
    const acc = []
    res.on('data', data => {
      acc.push(data)
    })
    res.once('end', () => {
      assert.equal(res.statusCode, 200)
      assert.equal(
        Buffer.concat(acc).toString(),
        fs.readFileSync(__filename, 'utf8')
      )
      server.close()
    })
  })

  return kserver.get('closed')
}))

test('response splitting: header key', assert => Promise.try(() => {
  const server = http.createServer().listen(60880)
  const mw = []
  const kserver = knork('anything', server, routing`
    GET / view
  `({
    view (req) {
      return reply('hello!', 200, {
        [req.query.p]: 'OK'
      })
    }
  }), mw)

  const conn = net.connect(60880)
  conn.on('data', data => {
    data = String(data).split('\n')
    assert.equal(data[0], 'HTTP/1.1 500 Internal Server Error\r')
    data = data.filter(xs => /Only ISO-8859-1 strings are valid in headers/.test(xs))
    assert.equal(data.length, 1)
    server.close()
  })
  conn.end(`GET /?p=%E0%B4%8A HTTP/1.1
Host: localhost:60880
Connection: close\r\n\r\n`)
  return kserver.get('closed')
}))

test('response splitting: header value', assert => Promise.try(() => {
  const server = http.createServer().listen(60880)
  const mw = []
  const kserver = knork('anything', server, routing`
    GET / view
  `({
    view (req) {
      return reply('hello!', 200, {
        anything: req.query.p
      })
    }
  }), mw)

  const conn = net.connect(60880)
  conn.on('data', data => {
    data = String(data).split('\n')
    assert.equal(data[0], 'HTTP/1.1 500 Internal Server Error\r')
    data = data.filter(xs => /Only ISO-8859-1 strings are valid in headers/.test(xs))
    assert.equal(data.length, 1)
    server.close()
  })
  conn.end(`GET /?p=%E0%B4%8A HTTP/1.1
Host: localhost:60880
Connection: close\r\n\r\n`)
  return kserver.get('closed')
}))

test('returning object stream works', assert => Promise.try(() => {
  const server = http.createServer().listen(60880)
  const mw = []
  const kserver = knork('anything', server, routing`
    GET / view
  `({
    view (req) {
      return reply(new Readable({
        objectMode: true,
        read (n) {
          this.push({message: 'hello!'})
          this.push(null)
        }
      }), 210, {'test': 1234})
    }
  }), mw)

  http.get({method: 'GET', path: '/', port: 60880}, res => {
    res.on('data', data => {
      assert.equal(res.statusCode, 210)
      assert.equal(res.headers.test, '1234')
      assert.equal(
        res.headers['content-type'],
        'application/x-ndjson; charset=utf-8'
      )
      assert.equal(data + '', '{"message":"hello!"}\n')
      server.close()
    })
  })

  return kserver.get('closed')
}))

test('failing object stream works', assert => Promise.try(() => {
  const server = http.createServer().listen(60880)
  const mw = []
  const out = [{}, {}, {}, {}, {shouldNotSee: 1}, null]
  out[3].breaking = out[3]
  const kserver = knork('anything', server, routing`
    GET / view
  `({
    view (req) {
      return reply(new Readable({
        objectMode: true,
        read (n) {
          var last = true
          do {
            last = this.push(out.shift())
          } while (last && out.length)
        }
      }), 200, {'content-type': 'application/hats'})
    }
  }), mw)

  http.get({method: 'GET', path: '/', port: 60880}, res => {
    const acc = []
    res.on('data', data => {
      acc.push(data)
    })

    res.on('end', () => {
      const data = Buffer.concat(acc).toString()
      assert.equal(res.statusCode, 200)
      assert.equal(
        res.headers['content-type'],
        'application/hats'
      )
      assert.equal(data, `{}
{}
{}
{"error":"Converting circular structure to JSON"}
`)
      server.close()
    })
  })

  return kserver.get('closed')
}))

test('returning string works', assert => Promise.try(() => {
  const server = http.createServer().listen(60880)
  const kserver = knork('anything', server, routing`
    GET / view
  `({
    view (req) {
      return 'hi there!'
    }
  }), [])

  http.get({method: 'GET', path: '/', port: 60880}, res => {
    res.on('data', data => {
      assert.equal(res.statusCode, 200)
      assert.equal(data + '', 'hi there!')
      assert.equal(res.headers['content-type'], 'text/plain; charset=utf-8')
      server.close()
    })
  })

  return kserver.get('closed')
}))

test('returning empty string omits content-type', assert => Promise.try(() => {
  const server = http.createServer().listen(60880)
  const kserver = knork('anything', server, routing`
    GET / view
  `({
    view (req) {
      return ''
    }
  }), [])

  http.get({method: 'GET', path: '/', port: 60880}, res => {
    const acc = []
    res.on('data', data => {
      acc.push(data)
    })

    res.on('end', () => {
      const data = Buffer.concat(acc).toString()
      assert.equal(res.statusCode, 204)
      assert.equal(data, '')
      assert.ok(!('content-type' in res.headers))
      server.close()
    })
  })

  return kserver.get('closed')
}))

test('returning nothing works', assert => Promise.try(() => {
  const server = http.createServer().listen(60880)
  const kserver = knork('anything', server, routing`
    GET / view
  `({
    view (req) {
    }
  }), [])

  http.get({method: 'GET', path: '/', port: 60880}, res => {
    const acc = []
    res.on('data', data => {
      acc.push(data)
    })
    res.once('end', () => {
      assert.equal(res.statusCode, 204)
      assert.equal(
        Buffer.concat(acc).toString(),
        ''
      )
      server.close()
    })
  })

  return kserver.get('closed')
}))

test('returning buffer works: no content-type', assert => Promise.try(() => {
  const server = http.createServer().listen(60880)
  const kserver = knork('anything', server, routing`
    GET / view
  `({
    view (req) {
      return new Buffer('hello world')
    }
  }), [])

  http.get({method: 'GET', path: '/', port: 60880}, res => {
    const acc = []
    res.on('data', data => {
      acc.push(data)
    })
    res.once('end', () => {
      assert.equal(res.statusCode, 200)
      assert.equal(
        Buffer.concat(acc).toString(),
        'hello world'
      )
      assert.equal(
        res.headers['content-type'],
        'application/octet-stream'
      )
      server.close()
    })
  })

  return kserver.get('closed')
}))

test('returning buffer works: w/ content-type', assert => Promise.try(() => {
  const server = http.createServer().listen(60880)
  const kserver = knork('anything', server, routing`
    GET / view
  `({
    view (req) {
      return reply.header(new Buffer('hello world'), 'content-type', 'text/hat')
    }
  }), [])

  http.get({method: 'GET', path: '/', port: 60880}, res => {
    const acc = []
    res.on('data', data => {
      acc.push(data)
    })
    res.once('end', () => {
      assert.equal(res.statusCode, 200)
      assert.equal(
        Buffer.concat(acc).toString(),
        'hello world'
      )
      assert.equal(
        res.headers['content-type'],
        'text/hat'
      )
      server.close()
    })
  })

  return kserver.get('closed')
}))

test('returning object works', assert => Promise.try(() => {
  const server = http.createServer().listen(60880)
  const kserver = knork('anything', server, routing`
    GET / view
  `({
    view (req) {
      return {test: 'anything!'}
    }
  }), [])

  http.get({method: 'GET', path: '/', port: 60880}, res => {
    const acc = []
    res.on('data', data => {
      acc.push(data)
    })
    res.once('end', () => {
      assert.equal(res.statusCode, 200)
      assert.equal(
        Buffer.concat(acc).toString(),
        '{"test":"anything!"}'
      )
      assert.equal(
        res.headers['content-type'],
        'application/json; charset=utf-8'
      )
      server.close()
    })
  })

  return kserver.get('closed')
}))

test('throwing error works: external service', assert => Promise.try(() => {
  const server = http.createServer().listen(60880)
  const kserver = knork('anything', server, routing`
    GET / view
  `({
    view (req) {
      throw new Error('It fails!')
    }
  }), [])

  http.get({method: 'GET', path: '/', port: 60880}, res => {
    const acc = []
    res.on('data', data => {
      acc.push(data)
    })
    res.once('end', () => {
      assert.equal(res.statusCode, 500)
      assert.equal(
        Buffer.concat(acc).toString(),
        '{"message":"It fails!"}'
      )
      assert.equal(
        res.headers['content-type'],
        'application/json; charset=utf-8'
      )
      server.close()
    })
  })

  return kserver.get('closed')
}))

test('throwing error works: external service DEBUG=1', assert => Promise.try(() => {
  process.env.DEBUG = '1'
  const server = http.createServer().listen(60880)
  const kserver = knork('anything', server, routing`
    GET / view
  `({
    view (req) {
      throw new Error('It fails!')
    }
  }), [])

  http.get({method: 'GET', path: '/', port: 60880}, res => {
    process.env.DEBUG = ''
    const acc = []
    res.on('data', data => {
      acc.push(data)
    })
    res.once('end', () => {
      assert.equal(res.statusCode, 500)
      assert.equal(
        Buffer.concat(acc).toString(),
        '{\n  "message": "It fails!"\n}'
      )
      assert.equal(
        res.headers['content-type'],
        'application/json; charset=utf-8'
      )
      server.close()
    })
  })

  return kserver.get('closed')
}))

test('throwing error works: internal service', assert => Promise.try(() => {
  process.env.DEBUG = '1'
  const server = http.createServer().listen(60880)
  const kserver = knork('anything', server, routing`
    GET / view
  `({
    view (req) {
      throw new Error('It fails!')
    }
  }), [], {isExternal: false})

  http.get({method: 'GET', path: '/', port: 60880}, res => {
    process.env.DEBUG = ''
    const acc = []
    res.on('data', data => {
      acc.push(data)
    })
    res.once('end', () => {
      try {
        assert.equal(res.statusCode, 500)
        const data = JSON.parse(Buffer.concat(acc).toString())
        assert.equal(
          data.message,
          'It fails!'
        )
        assert.ok('stack' in data)
        assert.equal(
          res.headers['content-type'],
          'application/json; charset=utf-8'
        )
      } finally {
        return server.close()
      }
    })
  })

  return kserver.get('closed')
}))

test('returning rejection works', assert => Promise.try(() => {
}))

