'use strict'

module.exports = createCSRFMiddleware

const cryptiles = require('cryptiles')
const Promise = require('bluebird')

const reply = require('../reply')

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS', 'TRACE'])

function createCSRFMiddleware (opts) {
  opts = opts || {}
  const CSRF_TOKEN_HEADER = opts.headerName || 'x-csrf-token'
  const CSRF_TOKEN_COOKIE = opts.cookieName || 'csrftoken'
  const CSRF_TOKEN_KEY = opts.payloadName || 'csrftoken'
  const CSRF_TOKEN_SIZE = Number(opts.size) || 43

  return {
    processRequest (req, next) {
      const token = req.cookie(CSRF_TOKEN_COOKIE)
      req.csrf = (
        token ||
        cryptiles.randomString(CSRF_TOKEN_SIZE)
      )
      req.resetCSRF = !token

      return next().then(resp => {
        if (req.resetCSRF) {
          return reply.cookie(resp, CSRF_TOKEN_COOKIE, req.csrf, {
            secure: true,
            httpOnly: true,
            sameSite: 'strict',
            path: '/'
          })
        }
        return resp
      })
    },

    processView (req, match, context, next) {
      if (match.controller[match.name].csrfExempt) {
        return next()
      }

      if (SAFE_METHODS.has(req.method.toUpperCase())) {
        return next()
      }

      const getValue = (
        match.controller[match.name].restful
        ? Promise.resolve(req.headers[CSRF_TOKEN_HEADER])
        : req.body.then(body => body ? body[CSRF_TOKEN_KEY] : null)
      )

      return getValue.then(value => {
        if (!value || value !== req.csrf) {
          throw new reply.ForbiddenError()
        }

        return next().then(xs => {
          // allow for resetting CSRF token on login
          if (match.controller[match.name].resetCSRF) {
            req.csrf = cryptiles.randomString(opts.CSRF_TOKEN_SIZE)
            req.resetCSRF = true
          }

          return xs
        })
      })
    }
  }
}
