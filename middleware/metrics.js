'use strict'

module.exports = createMiddleware

const publicHTTP = require('../http')
const REQ_TO_STATS = new WeakMap()

function createMiddleware (metrics) {
  return {
    processRequest (req) {
      REQ_TO_STATS.set(req, new Stats())
    },
    processView (req, match, context) {
      if (!REQ_TO_STATS.has(req)) {
        return
      }
      const stats = REQ_TO_STATS.get(req)
      const name = []
      for (var xs of match) {
        name.push(xs.name)
      }
      stats.setView(name.reverse().join('.'))
    },
    processResponse (req, res) {
      recordMetric(req, res, 200)
    },
    processError (req, err) {
      recordMetric(req, err, 500)
    }
  }
}

class Stats {
  constructor () {
    this.start = Date.now()
    this.view = '(middleware)'
  }
  diff () {
    return Date.now() - this.start
  }
  setView (view) {
    this.view = view
  }
}

function recordMetric (req, res, defaultCode) {
  if (!REQ_TO_STATS.has(req)) {
    return
  }
  const stats = REQ_TO_STATS.get(req)
  const latency = stats.diff()
  req.metric({
    name: 'latency',
    value: latency,
    route: stats.view
  })
  req.metric({
    name: 'response',
    statusCode: publicHTTP.status(res) || defaultCode,
    value: latency,
    route: stats.view
  })
}
