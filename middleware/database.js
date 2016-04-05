'use strict'

module.exports = createDatabaseMiddleware

const Promise = require('bluebird')

const pg = require('../db/connection')
const db = require('../db/session')
const orm = require('../db/orm')

function createDatabaseMiddleware (opts) {
  opts = opts || {}
  opts.postgres = opts.postgres || {}
  orm.setConnection(db.getConnection)
  var poolTimer = null
  return {
    install (knork) {
      opts.metrics = opts.metrics || defaultMetrics(knork.name)
      poolTimer = setInterval(() => {
        const pools = Object.keys(pg.pools.all)

        if (pools.length !== 1) {
          return
        }

        const pool = pg.pools.all[pools[0]]
        process.emit('metric', {
          'name': `${knork.name}.pg-pool-available`,
          'value': pool.availableObjectsCount()
        })
        process.emit('metric', {
          'name': `${knork.name}.pg-pool-waiting`,
          'value': pool.waitingClientsCount()
        })
      }, 1000)
    },
    processRequest (request) {
      db.install(process.domain, () => {
        return new Promise((resolve, reject) => {
          pg.connect(opts.postgres, (err, connection, release) => {
            err ? reject(err) : resolve({connection, release})
          })
        })
      }, Object.assign(
        {},
        opts.metrics || {},
        {maxConcurrency: opts.maxConnectionsPerRequest}
      ))
    },
    processView (req, match) {
      db.session.viewName = req.viewName
    },
    onServerClose () {
      clearInterval(poolTimer)
      pg.end()
    }
  }
}

function defaultMetrics (name) {
  var lastIdleTime = Date.now()
  var emittedIdleExit = false
  const batonMap = new WeakMap()
  return {
    onSessionIdle () {
      lastIdleTime = Date.now()
      emittedIdleExit = false
    },
    onSubsessionStart (parent, child) {
      child.viewName = parent.viewName
    },
    onConnectionRequest (baton) {
      // (onConnectionRequest - lastIdleTime) = "how long do we idle for?"
      const now = Date.now()
      if (!emittedIdleExit) {
        emittedIdleExit = true
        process.emit('metric', {
          name: `${name}.idleTime`,
          value: now - lastIdleTime
        })
      }
      batonMap.set(baton, {
        request: now,
        start: null
      })
    },
    onConnectionStart (baton) {
      // onConnectionStart - onConnectionRequest = "How long did we have to
      // wait for other connections (server-wide!) to complete?"
      const info = batonMap.get(baton)
      if (!info) {
        return
      }
      info.start = Date.now()
      process.emit('metric', {
        name: `${name}.connectionWait`,
        value: info.start - info.request,
        view: db.session.viewName
      })
    },
    onConnectionFinish (baton) {
      const info = batonMap.get(baton)
      if (!info) {
        return
      }
      process.emit('metric', {
        name: `${name}.connectionDuration`,
        value: Date.now() - info.start,
        view: db.session.viewName
      })
    },
    onTransactionConnectionRequest (txnBaton) {
      process.emit('metric', {
        name: `${name}.query`,
        value: 1,
        view: db.session.viewName
      })
      batonMap.set(txnBaton, {
        request: Date.now(),
        start: null
      })
    },
    onTransactionConnectionStart (txnBaton) {
      // onTransactionConnectionStart - onTransactionConnectionRequest = "How
      // long did we have to wait for other connections (request-wide!) to
      // complete?"
      const info = batonMap.get(txnBaton)
      if (!info) {
        return
      }
      info.start = Date.now()
      process.emit('metric', {
        name: `${name}.transactionWait`,
        value: info.start - info.request,
        view: db.session.viewName
      })
    },
    onTransactionConnectionFinish (txnBaton) {
      const info = batonMap.get(txnBaton)
      if (!info) {
        return
      }
      process.emit('metric', {
        name: `${name}.transactionDuration`,
        value: Date.now() - info.start,
        view: db.session.viewName
      })
    }
  }
}
