'use strict'

const http = require('http')

const {register} = require('./index.js')
const logging = require('../../logging')
const knork = require('../../knork')

register({
  command: 'runserver',
  describe: 'run the server',
  handler
})

function handler (argv) {
  const settings = argv.settings
  const server = http.createServer().listen(settings.PORT, settings.HOST || null)
  const logger = logging(`${settings.NAME}-${process.pid}`)
  return knork(settings.NAME, server, settings.ROUTER, settings.MIDDLEWARE, {
    metrics: settings.METRICS,
    isExternal: settings.IS_EXTERNAL,
    requestIDHeaders: settings.REQUEST_ID_HEADERS,
    onclienterror: settings.ON_CLIENT_ERROR,
    settings
  }).then(app => {
    logger.info(`online at http://${settings.HOST || 'localhost'}:${settings.PORT}`)
  })
}
