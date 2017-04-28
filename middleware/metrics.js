'use strict'

module.exports = createMiddleware

const procMetrics = require('numbat-process')

const reply = require('../reply')

function createMiddleware () {
  var closeProcMetrics = null
  return {
    install (knork) {
      const procMetricsInterval = (
        Number(process.env.PROCESS_METRICS_INTERVAL) ||
        1000 * 30
      )
      closeProcMetrics = procMetrics(knork.metrics, procMetricsInterval)
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

function recordMetric (req, res, defaultCode) {
  const latency = req.latency
  process.emit('metric', {
    name: 'latency',
    value: latency,
    route: req.viewName
  })
  const status = reply.status(res) || defaultCode
  process.emit('metric', {
    name: 'response',
    statusCode: status,
    value: latency,
    route: req.viewName
  })
}
