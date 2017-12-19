'use strict'

const resolve = require('resolve')
const findup = require('find-up')
const Module = require('module')
const path = require('path')

const instantiate = require('./instantiate')

module.exports = hotRequire

function hotRequire (dirname, settings) {
  const projectModulesDir = findup.sync('node_modules', {cwd: dirname})
  const projectDir = projectModulesDir.replace(/\/node_modules$/, '')
  hotRequire.projectDir = projectDir

  extendRequire(dirname, projectDir)
  hotRequire.routerPath = resolve.sync(settings.ROUTER, {basedir: dirname})
  delete require.cache[hotRequire.routerPath]

  // need to track instantiated middleware objects and their corresponding
  // paths
  let middleware = settings.MIDDLEWARE.map(line => instantiate(dirname, line))

  hotRequire.middlewarePaths = middleware.map((mw, idx) => {
    const line = settings.MIDDLEWARE[idx]
    const identifier = getIdentifier(line)
    const mwPath = resolve.sync(identifier, {basedir: dirname})
    return [mwPath, mw, line]
  })
  settings.MIDDLEWARE = middleware
}

hotRequire.sources = new Map()
hotRequire.projectDir = null
hotRequire.routerPath = null
hotRequire.middlewarePaths = []

let installed = false

let cachedCrypto

function extendRequire (dirname, projectDir) {
  if (installed) return

  const nativeLoad = Module._load

  Module._load = function (request, parent, isMain) {
    const load = () => nativeLoad.call(this, request, parent, isMain)

    if (request === 'crypto') {
      // webpack `require('crypto')`s hundreds of times on a hot update.
      // cache it here and get a 3x speed up.
      if (!cachedCrypto) cachedCrypto = load()
      return cachedCrypto
    }
    const basedir = path.dirname(parent.filename)

    const resolved = resolve.sync(request, {
      basedir,
      extensions: ['.js', '.json', '.node']
    })

    if (!resolved.includes(projectDir)) return load()

    const sources = hotRequire.sources
    const alreadyHad = sources.has(resolved)
    if (!alreadyHad) sources.set(resolved, new Set())
    sources.get(resolved).add(parent.filename)
    if (!alreadyHad) process.emit('knork-hot-add', resolved)

    return load()
  }

  installed = true
}

function getIdentifier (lineitem) {
  return Array.isArray(lineitem) ? lineitem[0] : lineitem
}
