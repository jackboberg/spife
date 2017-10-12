'use strict'

const {Environment, FileSystemLoader} = require('nunjucks')
const Loader = require('@npm/knork/templates/loader')
const path = require('path')

const isDev = !new Set(['prod', 'production', 'stag', 'staging']).has(
  process.env.NODE_ENV
)

const templateDirs = [path.join(__dirname, '..', 'templates')]
const nunjucksEnv = new Environment(new FileSystemLoader(templateDirs))
const nunjucksLoader = new Loader({
  dirs: templateDirs,
  load (resolved) {
    const template = nunjucksEnv.getTemplate(resolved.path, true)
    return context => {
      return template.render(context)
    }
  }
})

module.exports = {
  DEBUG: process.env.DEBUG,
  ENABLE_FORM_PARSING: false,
  METRICS: process.env.METRICS,
  MIDDLEWARE: [
    '@npm/knork/middleware/debug',
    ['@npm/knork/middleware/template', [
      nunjucksLoader
    ], [
      // template context processors go here
    ]],
    '@npm/knork/middleware/common',
    '@npm/knork/middleware/logging',
    '@npm/knork/middleware/metrics',
    '@npm/knork/middleware/monitor',
    ['@npm/knork/middleware/csrf', {secureCookie: !isDev}]
  ],
  NAME: 'nunjucks-example',
  NODE_ENV: process.env.NODE_ENV,
  PORT: 8124,
  ROUTER: './routes/index.js'
}
