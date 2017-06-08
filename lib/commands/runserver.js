'use strict'

const replify = require('replify')
const http = require('http')

const {register} = require('./index.js')
const logging = require('../../logging')
const knork = require('../../knork')

register({
  command: 'runserver',
  describe: 'run the server',
  builder,
  handler
})

function builder (yargs) {
  yargs
    .boolean('debug')
    .describe('debug', 'enable long stack traces and expose traces in errors')
    .alias('d', 'debug')
}

function handler (argv) {
  const settings = argv.settings
  const server = http.createServer().listen(settings.PORT, settings.HOST || null)
  const logger = logging(`${settings.NAME}-${process.pid}`)
  return knork(settings.NAME, server, settings.ROUTER, settings.MIDDLEWARE, {
    maxBodySize: settings.MAX_REQUEST_BODY_SIZE || 1 << 20,
    metrics: settings.METRICS,
    isExternal: settings.IS_EXTERNAL,
    enableFormParsing: settings.ENABLE_FORM_PARSING,
    requestIDHeaders: settings.REQUEST_ID_HEADERS,
    onclienterror: settings.ON_CLIENT_ERROR
  }).then(() => {
    logger.info(`online at http://${settings.HOST || 'localhost'}:${settings.PORT}`)
  })
}
