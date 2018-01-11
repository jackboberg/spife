'use strict'

const isDev = !new Set(['prod', 'production', 'stag', 'staging']).has(
  process.env.NODE_ENV
)

module.exports = {
  DEBUG: process.env.DEBUG,
  ENABLE_FORM_PARSING: false,
  METRICS: process.env.METRICS,
  MIDDLEWARE: [
    '@npm/spife/middleware/debug',
    ['@npm/spife/middleware/template', [
      // template loaders go here
    ], [
      // template context processors go here
    ]],
    '@npm/spife/middleware/common',
    '@npm/spife/middleware/logging',
    '@npm/spife/middleware/metrics',
    '@npm/spife/middleware/monitor',
    ['@npm/spife/middleware/csrf', {secureCookie: !isDev}]
  ],
  NAME: '$$NAME$$',
  NODE_ENV: process.env.NODE_ENV,
  PORT: 8124,
  ROUTER: './routes/index.js'
}
