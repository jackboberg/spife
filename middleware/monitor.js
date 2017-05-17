'use strict'

module.exports = makeMonitorMiddleware

const exec = require('child_process').exec
const Promise = require('bluebird')

const reply = require('../reply')

function makeMonitorMiddleware () {
  return {
    processServer (knork, next) {
      this.name = knork.name
      return next()
    },
    processRequest (req, next) {
      if (req.urlObject.pathname === '/_monitor/ping') {
        return pingResponse()
      }
      if (req.urlObject.pathname === '/_monitor/status') {
        return statusResponse(this.name)
      }
      return next()
    }
  }
}

function pingResponse () {
  return reply.raw('pong')
}

function statusResponse (name) {
  return Promise.props({
    name: name,
    pid: process.pid,
    uptime: process.uptime(),
    rss: process.memoryUsage(),
    git: gitHead(),
    message: gitMessage()
  })
}

function gitHead () {
  return new Promise((resolve, reject) => {
    exec('git rev-parse HEAD', (err, stdout) => {
      err ? reject(err) : resolve(stdout.trim())
    })
  })
}

function gitMessage () {
  return new Promise((resolve, reject) => {
    exec('git log --oneline --abbrev-commit  -n 1', (err, stdout) => {
      err ? reject(err) : resolve(stdout.trim())
    })
  })
}
