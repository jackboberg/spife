'use strict'

module.exports = createMiddleware

const procMetrics = require('numbat-process')

const reply = require('../reply')
const REQ_TO_STATS = new WeakMap()

function createMiddleware () {
  var closeProcMetrics = null
  return {
    install (knork) {
      closeProcMetrics = procMetrics(knork.metrics, 1000)
    },
    processRequest (req) {
      REQ_TO_STATS.set(req, new Stats())
    },
    processView (req, match, context) {
      if (!REQ_TO_STATS.has(req)) {
        return
      }
      const stats = REQ_TO_STATS.get(req)
      stats.setView(req.viewName)
    },
    processResponse (req, res) {
      recordMetric(req, res, 200)
    },
    processError (req, err) {
      recordMetric(req, err, 500)
    },
    onServerClose () {
      closeProcMetrics()
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
  process.emit('metric', {
    name: 'latency',
    value: latency,
    route: stats.view
  })
  const status = reply.status(res) || defaultCode
  process.emit('metric', {
    name: 'response',
    statusCode: status,
    value: latency,
    route: stats.view
  })
  console.log({status, latency})
}
