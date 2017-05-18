'use strict'

module.exports = createTemplateMiddleware

const Promise = require('bluebird')

const reply = require('../reply')

function createTemplateMiddleware (loaders = [], context = []) {
  return middleware

  function middleware (req, next) {
    return next().then(resp => {
      if (!(resp instanceof reply.template.Response)) {
        return resp
      }
      const start = Date.now()

      return Promise.join(
        resp.lookup(loaders, req),
        Promise.all(context.map(xs => xs(req)))
      ).spread((pair, contexts) => {
        process.emit('metric', {
          name: 'template.lookup',
          value: Date.now() - start,
          template: resp.name
        })
        return resp.render(
          pair,
          contexts
        )
      })
    })
  }
}
