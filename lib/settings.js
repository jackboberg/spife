'use strict'

module.exports = {load}

const resolve = require('resolve')
const path = require('path')

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
    DEBUG: false
  }, require(filename))

  settings.MIDDLEWARE = settings.MIDDLEWARE.map(
    xs => instantiate(dirname, xs)
  )

  if (!settings.ROUTER) {
    throw new Error('knork settings files should specify a ROUTER value')
  }

  settings.ROUTER = resolveRequire(dirname, settings.ROUTER)

  return settings
}

function resolveRequire (dirname, str) {
  const filename = resolve.sync(str, {basedir: dirname})
  return require(filename)
}

function instantiate (dirname, lineitem, ...config) {
  return (
    typeof lineitem === 'string'
    ? resolveRequire(dirname, lineitem)(...config)
    : (
      Array.isArray(lineitem)
      ? instantiate(dirname, ...lineitem)
      : lineitem
    )
  )
}
