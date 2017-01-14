'use strict'

module.exports = createTemplateMiddleware

const Promise = require('bluebird')

const reply = require('../reply')

function createTemplateMiddleware (loaders, context) {
  return {
    context: context || [],
    loaders: loaders || [],
    processResponse (req, resp) {
      if (!(resp instanceof reply.template.Response)) {
        return
      }
      const start = Date.now()

      return Promise.join(
        resp.lookup(this.loaders, req),
        Promise.all(this.context.map(xs => xs(req)))
      ).then(([pair, contexts]) => {
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
    }
  }
}
