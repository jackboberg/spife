'use strict'

module.exports = createMiddleware

const procMetrics = require('numbat-process')

const reply = require('../reply')

function createMiddleware () {
  var closeProcMetrics = null
  return {
    processServer (knork, next) {
      const procMetricsInterval = (
        Number(process.env.PROCESS_METRICS_INTERVAL) ||
        1000 * 30
      )
      closeProcMetrics = procMetrics(knork.metrics, procMetricsInterval)
      return next().then(() => {
        closeProcMetrics()
      })
    },

    processRequest (req, next) {
      return next().then(resp => {
        recordMetric(req, resp, 200)
        return resp
      }).catch(err => {
        recordMetric(req, err, 500)
        throw err
      })
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
