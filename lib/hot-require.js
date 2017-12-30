'use strict'

const findup = require('find-up')
const Module = require('module')
const path = require('path')

const instantiate = require('./instantiate')

module.exports = hotRequire

function hotRequire (filename, settings) {
  if (hotRequire.projectDir) {
    return
  }

  hotRequire.settingsPath = filename
  const dirname = path.dirname(filename)
  const projectModulesDir = findup.sync('node_modules', {cwd: dirname})
  const projectDir = path.dirname(projectModulesDir)
  hotRequire.projectDir = projectDir

  extendRequire(dirname, projectDir)
}

hotRequire.settingsPath = null
hotRequire.sources = new Map()
hotRequire.projectDir = null

const nativeModules = new Set(Object.keys(process.binding('natives')))
const settingsLoaderPath = require.resolve('./settings.js')

function extendRequire (dirname, projectDir) {
  const nativeLoad = Module._load

  Module._load = function (request, parent, isMain) {
    if (nativeModules.has(request)) {
      return nativeLoad.call(this, request, parent, isMain)
    }

    // ignore any requests _coming from_ node_modules unless the parent is our
    // lib/settings.js
    if (
      parent.filename !== settingsLoaderPath &&
      parent.filename.replace(projectDir).slice(0, '/node_modules'.length) === '/node_modules'
    ) {
      return nativeLoad.call(this, request, parent, isMain)
    }

    // resolve the request to a filename. if the request resolves to a file in
    // node_modules, ignore it.
    const resolved = Module._resolveFilename(request, parent, false)
    if (!resolved.includes(projectDir) ||
        /node_modules/.test(resolved.replace(projectDir))) {
      return nativeLoad.call(this, request, parent, isMain)
    }

    const alreadyHad = hotRequire.sources.has(resolved)
    if (!alreadyHad) {
      hotRequire.sources.set(resolved, new Set())
    }
    hotRequire.sources.get(resolved).add(parent.filename)
    if (!alreadyHad) {
      process.emit('knork-hot-add')
    }

    return nativeLoad.call(this, request, parent, isMain)
  }
}

function getIdentifier (lineitem) {
  return Array.isArray(lineitem) ? lineitem[0] : lineitem
}
