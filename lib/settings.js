'use strict'

module.exports = {load}

const resolve = require('resolve')
const path = require('path')

const instantiate = require('./instantiate')
const hotRequire = require('./hot-require')

function load (filename) {
  // take a path + object, turn it into real objects
  const dirname = path.dirname(filename)
  const settings = Object.assign({
    NAME: 'knork',
    IS_EXTERNAL: true,
    ENABLE_FORM_PARSING: false,
    MAX_REQUEST_BODY_SIZE: 1 << 20,
    METRICS: null,
    REQUEST_ID_HEADERS: ['request-id'],
    ON_CLIENT_ERROR: () => {},
    MIDDLEWARE: [],
    ROUTER: null,
    PORT: null,
    HOST: null,
    NODE_ENV: process.env.NODE_ENV || 'development',
    DEBUG: false,
    HOT: false
  }, require(filename))

  if (!settings.ROUTER) {
    throw new Error('knork settings files should specify a ROUTER value')
  }

  if (settings.HOT) {
    hotRequire(filename, settings)
  }

  settings.MIDDLEWARE = settings.MIDDLEWARE.map(
    xs => instantiate(dirname, xs)
  )

  const routerFile = resolve.sync(settings.ROUTER, {basedir: dirname})
  settings.ROUTER = require(routerFile)

  return settings
}
