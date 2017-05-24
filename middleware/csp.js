'use strict'

module.exports = createCSPMiddleware

const reply = require('../reply')

function createCSPMiddleware (settings, options) {
  return (req, next) => {
    return next().then(resp => {
      const defaults = {
        'connect-src': `'self'`,
        'default-src': `'none'`,
        'img-src': `'self'`,
        'script-src': `'self'`,
        'style-src': `'self'`
      }

      const keywords = [
        'self',
        'none',
        'unsafe-inline',
        'unsafe-eval'
      ]

      const policy = Object.assign({}, defaults, settings)

      const csp = Object.keys(policy).map(directive => {
        const sourceList = Array.prototype.concat(policy[directive])
          .map(source => {
            return keywords.find(word => word === source)
              ? `'${source}'`
              : source
          })
        return `${directive} ${sourceList.join(' ')}`
      }).join(';')

      const header = options && options.reportOnly
        ? 'Content-Security-Policy-Report-Only'
        : 'Content-Security-Policy'

      reply.header(resp, header, csp)
      reply.header(resp, `X-${header}`, csp)
      return resp
    })
  }
}
