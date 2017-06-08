'use strict'

const isDev = !new Set(['prod', 'production', 'stag', 'staging']).has(
  process.env.NODE_ENV
)

module.exports = {
  DEBUG: process.env.DEBUG,
  ENABLE_FORM_PARSING: false,
  METRICS: process.env.METRICS,
  MIDDLEWARE: [
    '@npm/knork/middleware/debug',
    ['@npm/knork/middleware/template', [
      // template loaders go here
    ], [
      // template context processors go here
    ]],
    '@npm/knork/middleware/common',
    '@npm/knork/middleware/logging',
    '@npm/knork/middleware/metrics',
    '@npm/knork/middleware/monitor',
    ['@npm/knork/middleware/csrf', {secureCookie: !isDev}]
  ],
  NAME: '$$NAME$$',
  NODE_ENV: process.env.NODE_ENV,
  PORT: 8124,
  ROUTER: './routes/index.js'
}
