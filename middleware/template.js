'use strict'

module.exports = createTemplateMiddleware

const Promise = require('bluebird')

const {serialize} = require('../lib/serialize')
const reply = require('../reply')

class TemplateResolution {
  constructor (renderer, loader, name) {
    this.renderer = renderer
    this.loader = loader
    this.name = name
  }
}

class TemplateNotFound extends Error {
  constructor (name) {
    super(`Could not find template matching "${name}."`)
  }
}

function createTemplateMiddleware (loaders = [], context = []) {
  return {
    processRequest (req, next) {
      return next().then(resp => {
        const template = reply.template(resp)
        if (!template) {
          return resp
        }

        const headers = reply.headers(resp)
        const status = reply.status(resp)
        headers['content-type'] = 'text/html'
        const start = Date.now()
        return Promise.join(
          lookup(template, req),
          toContext(req, resp)
        ).then(([resolution, context]) => {
          process.emit('metric', {
            name: 'template.lookup',
            value: Date.now() - start,
            template: resp.name
          })
          return render(resolution, context)
        }).then(str => {
          return reply(str, status, headers)
        })
      })
    },

    lookup (template, req) {
      return lookup(template, req)
    },

    toContext (req, context) {
      return toContext(req, context)
    }
  }

  function toContext (req, resp) {
    return Promise.all(context.map(fn => {
      return Promise.try(() => fn(req))
    })).then(contexts => {
      return serialize(Object.assign({}, resp, ...contexts))
    })
  }

  function lookup (template, req) {
    return loaders.reduce((acc, loader) => {
      return acc.then(resolution => {
        if (resolution) {
          return resolution
        }
        return Promise.try(() => {
          return loader.get(template, req)
        }).then(renderer => {
          if (renderer) {
            return new TemplateResolution(renderer, loader, template)
          }
        })
      })
    }, Promise.resolve()).then(resolution => {
      if (!resolution) {
        throw new TemplateNotFound(template)
      }
      return resolution
    })
  }

  function render (resolution, context) {
    const renderer = resolution.renderer
    const start = Date.now()
    return Promise.try(() => renderer(context)).then(str => {
      process.emit('metric', {
        name: 'template.render',
        value: Date.now() - start,
        template: resolution.name
      })
      return str
    }).catch(err => {
      err.resolution = resolution
      throw err
    })
  }
}
