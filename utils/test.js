'use strict'

const Promise = require('bluebird')
const http = require('http')
const fs = require('fs')

/* eslint-disable node/no-deprecated-api */
const domain = require('domain')
/* eslint-enable node/no-deprecated-api */

const pg = require('../db/connection')
const db = require('../db/session')
const orm = require('../db/orm')
const spife = require('..')

const routeMetrics = new Map()

pg.defaults.poolIdleTimeout = Infinity

module.exports = {
  createTransactionalTest
}

function createTransactionalTest (baseTest, routes, middleware, dbName, port) {
  process.nextTick(outputRouteMetrics)
  port = port || 60808
  return test

  function test (name, run) {
    baseTest(name, assert => Promise.try(() => {
      // this reads a bit like spaghetti, but to explain:
      // 1. instead of using spife's builtin database and transaction
      //    middleware, we're rolling our own, because we want to
      //    ROLLBACK the database between tests.
      // 2. so we create a domain and start a transaction inside of
      //    it...
      //   a. capturing the db-session,
      //   b. letting the outside world know we have it,
      //   c. and returning a promise for completion that we control
      //      from the outside.
      // 3. we set up a spife server that has middleware that automatically
      //    associates the request domain with our transaction session.
      // 4. once we have a listening spife server *and* we've got the
      //    transaction session, we run the test inside its _own_ domain
      //    so we can associate that stack with the transaction session.
      // 5. once we're done, we reject the transaction promise so that
      //    the session is rolled back and close the server.
      // 6. then once eeeeeverything else is done, we shutdown the pg pool.

      const server = http.createServer().listen(port)
      const testDomain = domain.create()
      const batonMap = new WeakMap()
      const pool = new pg.Pool({database: dbName})

      // 1.
      db.install(testDomain, () => {
        return new Promise((resolve, reject) => {
          pool.connect(function (err, connection, release) {
            return err ? reject(err) : resolve({
              connection,
              release
            })
          })
        })
      }, {
        onTransactionConnectionRequest (baton) {
          batonMap.set(baton, Date.now())
        },
        onTransactionConnectionFinish (baton) {
          const startTime = batonMap.get(baton)
          if (startTime && db.session.queries) {
            db.session.queries.push(Date.now() - startTime)
          }
        },
        onSubsessionStart (parent, child) {
          child.queries = parent.queries || []
          child.routeName = parent.routeName
          child.startTime = parent.startTime
        }
      })

      var rollbackTransaction = null
      /* eslint-disable promise/param-names */
      const transactionPromise = new Promise((_, reject) => {
        rollbackTransaction = reject
      })
      /* eslint-enable promise/param-names */

      var resolveSession = null
      var session = null
      const getSession = new Promise(resolve => {
        resolveSession = resolve
      })

      // 2.
      testDomain.run(() => {
        db.transaction(() => {
          // 2.a.
          session = db.session
          // 2.b.
          resolveSession()
          // 2.c.
          return transactionPromise
        })().catch(() => {})
      })

      // 3.
      const assignDomainMW = {
        processRequest (req, next) {
          return getSession.then(() => {
            session.assign(process.domain)
            db.session.queries = []
            db.session.startTime = Date.now()
            return next()
          })
        }
      }
      const trackRouteQueryCountMW = {
        processView (req, match, context, next) {
          db.session.routeName = req.viewName
          return next()
        },
        processRequest (req, next) {
          return next().then(resp => {
            aggregateInfo(
              db.session.routeName,
              db.session.queries,
              Date.now() - db.session.startTime
            )
            return resp
          })
        }
      }
      orm.setConnection(db.getConnection)
      const getServer = spife('test-server', server, routes, [
        assignDomainMW,
        trackRouteQueryCountMW
      ].concat(middleware), {isExternal: false})

      return getServer.return(getSession).then(() => {
        // 4.
        const subdomain = domain.create()
        session.assign(subdomain)
        return subdomain.run(() => run(assert))
      }).finally(() => {
        // 5.
        server.close()

        return getServer.get('closed').then(rollbackTransaction)
      }).finally(() => {
        // 6.
        pool.end()
      })
    }))
  }

  function outputRouteMetrics () {
    baseTest(assert => {
      fs.readFile('.routemetrics', 'utf8', (_, data) => {
        data = JSON.parse(data || '{}')
        for (var key in routeMetrics) {
          if (data[key]) {
            data[key].durationSamples = data[key].durationSamples.concat(
              routeMetrics[key].durationSamples
            )
            data[key].queryCounts = data[key].queryCounts.concat(
              routeMetrics[key].queryCounts
            )
            data[key].queryMetrics = data[key].queryMetrics.concat(
              routeMetrics[key].queryMetrics
            )
          } else {
            data[key] = routeMetrics[key]
          }
        }
        fs.writeFile('.routemetrics', JSON.stringify(data), () => {
          assert.end()
        })
      })
    })
  }

  function aggregateInfo (routeName, queries, duration) {
    if (!routeMetrics[routeName]) {
      routeMetrics[routeName] = {
        durationSamples: [],
        queryCounts: [],
        queryMetrics: []
      }
    }
    const metrics = routeMetrics[routeName]
    metrics.durationSamples.push(duration)
    metrics.queryCounts.push(queries.length)
    metrics.queryMetrics = metrics.queryMetrics.concat(queries)
  }
}
