'use strict'

module.exports = class Middleware {
  constructor ({
    processRequest,
    processServer,
    processBody,
    processView
  }) {
    this.processRequest = processRequest
    this.processServer = processServer
    this.processView = processView
    this.processBody = processBody
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
