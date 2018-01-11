'use strict'

const {spawn} = require('child_process')
const Tacks = require('tacks')
const path = require('path')
const fs = require('fs')

const {register} = require('./index.js')

const {File, Dir} = Tacks

register({
  command: 'init',
  describe: 'initialize a project, or an app within a project',
  builder
})

function builder (yargs) {
  yargs
    .command('app <name> [target]', 'create a new app within a project', {}, handleApp)
    .command('project <name> [target]', 'create a new project', {}, handleProject)
    .demandCommand()
}

function handleApp (argv) {
  const app = new Tacks(
    Dir({
      'index.js': File(
        "'use strict'\n" +
        '\n' +
        "module.exports = require('./routes')\n"
      ),
      'routes.js': File(
        "'use strict'\n" +
        '\n' +
        "const routes = require('@npm/spife/routing')\n" +
        '\n' +
        'module.exports = routes`\n' +
        '  GET / index\n' +
        "`(require('./views'))\n"
      ),
      'views.js': File(
        "'use strict'\n" +
        '\n' +
        'module.exports = {index}\n' +
        '\n' +
        'function index (req, context) {\n' +
        '\n' +
        '}\n'
      )
    })
  )

  const target = argv.target || argv.name
  app.create(target)
}

function handleProject (argv) {
  const project = new Tacks(
    Dir({
      bin: Dir({
        'manage.js': File(
          '#!/usr/bin/env node\n' +
          "const path = require('path')\n" +
          "process.env.KNORK_SETTINGS = path.join(__dirname, '..', 'lib', 'settings')\n" +
          "require('@npm/spife/bin/manage.js')\n"
        )
      }),
      lib: Dir({
        apps: Dir({
        }),
        'routes.js': File(
            "'use strict'\n" +
            '\n' +
            "const routes = require('@npm/spife/routing')\n" +
            '\n' +
            'module.exports = routes`\n' +
            '  GET / homepage\n' +
            "`(require('./views'))\n"
        ),
        'settings.js': File(
          "'use strict'\n" +
          '\n' +
          "const isDev = !new Set(['prod', 'production', 'stag', 'staging']).has(\n" +
          '  process.env.NODE_ENV\n' +
          ')\n' +
          '\n' +
          'module.exports = {\n' +
          '  HOT: isDev,\n' +
          '  DEBUG: process.env.DEBUG,\n' +
          '  METRICS: process.env.METRICS,\n' +
          '  MIDDLEWARE: [\n' +
          "    isDev ? '@npm/spife/middleware/hot-reload' : null,\n" +
          "    ['@npm/spife/middleware/template', [\n" +
          '      // template loaders go here\n' +
          '    ], [\n' +
          '      // template context processors go here\n' +
          '    ]],\n' +
          "    '@npm/spife/middleware/common',\n" +
          "    '@npm/spife/middleware/logging',\n" +
          "    '@npm/spife/middleware/metrics',\n" +
          "    '@npm/spife/middleware/monitor',\n" +
          "    ['@npm/spife/middleware/csrf', {secureCookie: !isDev}]\n" +
          '  ].filter(Boolean),\n' +
          "  NAME: '" + (argv.target || argv.name) + "',\n" +
          '  NODE_ENV: process.env.NODE_ENV,\n' +
          '  PORT: 8124,\n' +
          "  ROUTER: './routes.js'\n" +
          '}\n'
        ),
        'views.js': File(
          "'use strict'\n" +
          '\n' +
          'module.exports = {homepage}\n' +
          '\n' +
          'function homepage (req, context) {\n' +
          "  return 'welcome to spife!'\n" +
          '}\n'
        )
      }),
      test: Dir({
      })
    })
  )

  const target = argv.target || argv.name
  project.create(target)

  fs.chmodSync(path.join(target, 'bin', 'manage.js'), 0o755)

  const child = spawn('npm', ['init'], {
    env: Object.assign({}, process.env),
    cwd: path.resolve(target),
    stdio: 'inherit'
  })

  child.on('exit', code => {
    spawn('npm', ['install', '@npm/spife'], {
      env: Object.assign({}, process.env),
      cwd: path.resolve(target),
      stdio: 'inherit'
    })
  })
}
