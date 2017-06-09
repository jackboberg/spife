'use strict'

const Promise = require('bluebird')
const path = require('path')

const glob = Promise.promisify(require('glob'))

class MissingTemplateError extends Error {
  constructor (name) {
    super(
      `Could not find a template named "${name}"'.`
    )
  }
}

module.exports = class Loader {
  constructor ({basedir, dirs, load, extension = ''} = {}) {
    this.cache = new Map()
    this.basedir = basedir
    this.dirs = dirs
    this.load = load
    this.extension = extension
  }

  get (name, request) {
    const getTarget = (
      this.cache.has(name)
      ? this.cache.get(name)
      : this.templates().then(
        list => list.find(xs => xs.name === name)
      ).catch(() => null)
    )
    this.cache.set(name, getTarget)

    return getTarget.then(template => {
      if (!template) {
        this.cache.delete(name)
        throw new MissingTemplateError(name)
      }

      return this.getRenderFunction(template, request)
    })
  }

  getRenderFunction (template, request) {
    const getRenderTemplate = Promise.resolve(this.load(template, request))
    return getRenderTemplate.then(renderTemplate => {
      return (...args) => Promise.try(() => renderTemplate(...args))
    })
  }

  templates () {
    const result = Promise.all(this.dirs.map(dir => {
      return glob(`${dir}/**/*${this.extension}`)
    })).then(dirArrays => {
      const dirs = []
      const seen = new Set()

      for (var idx = 0; idx < dirArrays.length; ++idx) {
        const dirLen = this.dirs[idx].length
        for (var innerIdx = 0; innerIdx < dirArrays[idx].length; ++innerIdx) {
          const fullPath = dirArrays[idx][innerIdx]
          const fragment = fullPath.slice(dirLen + 1)
          if (seen.has(fragment)) {
            continue
          }

          seen.add(fragment)
          dirs.push({
            name: fragment.slice(0, -path.extname(fragment).length),
            path: fullPath
          })
        }
      }

      return dirs
    })

    this.templates = () => result

    // if we encounter an error, restore the original templates() function
    result.catch(() => {
      delete this.templates
    })
    return result
  }
}

module.exports.MissingTemplateError = MissingTemplateError
