'use strict'

module.exports = createTemplateMiddleware

const logger = require('../logging')('template-middleware')
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
    super(`Could not find template matching "${name}".`)
  }
}

class TemplateLoadError extends Error {
  constructor (err) {
    super(`Error loading template. Original message: ${err.message}`)
    this.original = err
  }
}

class TemplateContextError extends Error {
  constructor (err) {
    super(`Error loading context for template. Original message: ${err.message}`)
    this.original = err
  }
}

function createTemplateMiddleware (loaders = [], context = [], errorTemplateName = 'errors/template') {
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

        const getTemplate = lookup(template, req)
        const getContext = toContext(req, resp)
        const getRendered = Promise.join(
          getTemplate,
          getContext
        ).then(([resolution, context]) => {
          process.emit('metric', {
            name: 'template.lookup',
            value: Date.now() - start,
            template: resp.name
          })
          return render(resolution, context)
        })

        const getResponse = getRendered.then(str => {
          return reply(str, status, headers)
        })

        return getResponse.catch(error => {
          logger.error('caught error when trying to render response:')
          logger.error(error.original || error)
          return Promise.join(
            lookup(errorTemplateName),
            getContext.catch(TemplateContextError, () => null)
          ).then(([resolution, context]) => {
            return render(resolution, {
              context,
              error: {
                message: (error.original || error).message,
                stack: (error.original || error).stack,
                resolution: error.resolution
              }
            })
          }).then(str => {
            return reply(str, 500, {
              'cache-control': 'no-cache',
              'content-type': 'text/html'
            })
          }).catch(err => {
            logger.error('caught error when trying to render error template:')
            logger.error(err)
            throw (error.original || error)
          })
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
    }).catch(err => {
      throw new TemplateContextError(err)
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
    }, Promise.resolve()).catch(err => {
      throw new TemplateLoadError(err)
    }).then(resolution => {
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
