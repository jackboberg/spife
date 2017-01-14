'use strict'

module.exports = createTemplateResponse

const Promise = require('bluebird')

const reply = require('./reply')

function createTemplateResponse (name, context) {
  return new TemplateResponse(name, context)
}

class TemplateNotFound extends Error {
  constructor (name) {
    super(`Could not find template matching "${name}."`)
  }
}

class TemplateResponse {
  constructor (name, context = {}) {
    this.name = name
    this.context = context
  }

  lookup (loaders = [], req) {
    return Array.from(loaders).reduce((acc, loader) => {
      return acc.then(pair => {
        if (pair) {
          return pair
        }
        return Promise.try(() => loader.get(
          this.name,
          req
        )).then(renderer => {
          if (renderer) {
            return {renderer, loader}
          }
        })
      })
    }, Promise.resolve()).then(pair => {
      if (!pair) {
        throw new TemplateNotFound(this.name)
      }
      return pair
    })
  }

  render ({loader, renderer}, extraContext) {
    const status = reply.status(this)
    const headers = Object.assign(reply.headers(this) || {}, {
      'content-type': 'text/html'
    })
    const start = Date.now()

    const context = Object.assign(
      {},
      this.context,
      ...extraContext
    )

    return Promise.try(() => renderer(context)).then(str => {
      process.emit('metric', {
        name: 'template.render',
        value: Date.now() - start,
        template: this.name
      })
      return reply(str, status, headers)
    }).catch(err => {
      err.renderer = renderer
      err.name = this.name
      err.context = context
      err.loader = loader
      throw err
    })
  }

  static get NotFound () {
    return TemplateNotFound
  }
}

Object.assign(createTemplateResponse, {
  Response: TemplateResponse
})
