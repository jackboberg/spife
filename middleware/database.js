'use strict'

module.exports = createDatabaseMiddleware

const Promise = require('bluebird')

const pg = require('../db/connection')
const db = require('../db/session')
const orm = require('../db/orm')

function createDatabaseMiddleware (opts) {
  opts = opts || {}
  opts.metrics = opts.metrics || {}
  opts.postgres = opts.postgres || {}
  orm.setConnection(db.getConnection)
  return {
    processRequest (request) {
      db.install(process.domain, () => {
        return new Promise((resolve, reject) => {
          pg.connect(opts.connection, (err, connection, release) => {
            err ? reject(err) : resolve({connection, release})
          })
        })
      }, Object.assign(
        {},
        opts.metrics || {},
        {maxConcurrency: opts.maxConnectionsPerRequest}
      ))
    },
    onServerClose () {
      pg.end()
    }
  }
}
