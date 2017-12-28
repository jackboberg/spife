'use strict'

module.exports = createMiddleware

const procMetrics = require('numbat-process')
const EE = require('events')

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
      return next(knork).then(() => {
        closeProcMetrics()
      })
    },

    processRequest (req, next) {
      return next(req).then(resp => {
        recordMetric(req, resp, 200)
        return resp
      }).catch(err => {
        recordMetric(req, err, 500)
        throw err
      })
    },

    processBody (req, stream, next) {
      let size = 0
      const start = Date.now()
      EE.prototype.on.call(req, 'data', chunk => {
        size += chunk.length
      })

      return next(req, stream).then(result => {
        process.emit('metric', {
          name: 'body',
          fields: {
            latency: Date.now() - start,
            size
          },
          tags: {
            route: req.viewName,
            result: 'success'
          }
        })

        return result
      }, err => {
        process.emit('metric', {
          name: 'body',
          fields: {
            latency: Date.now() - start,
            size
          },
          tags: {
            route: req.viewName,
            result: 'failure'
          }
        })
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
