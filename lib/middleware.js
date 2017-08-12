'use strict'

module.exports = class Middleware {
  constructor ({
    processRequest = this.defaultRequest,
    processServer = this.defaultServer,
    processBody = this.defaultBody,
    processView = this.defaultView
  }) {
    this.processRequest = processRequest
    this.processServer = processServer
    this.processView = processView
    this.processBody = processBody
  }

  defaultBody (server, req, stream, next) {
    return next()
  }

  defaultServer (server, next) {
    return next()
  }

  defaultRequest (request, next) {
    return next()
  }

  defaultView (request, match, context, next) {
    return next()
  }

  static from (input) {
    if (typeof input === 'function') {
      input = {
        processRequest: input,
        processView: input.processView,
        processBody: input.processBody,
        processServer: input.processServer
      }
    }

    if (typeof input !== 'object' || !input) {
      throw new TypeError('expected middleware to be an object or function')
    }

    return new Middleware(input)
  }
}
