'use strict'

const resolve = require('resolve')

module.exports = instantiate

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
