'use strict'

module.exports = {register, run}

const Yargs = require('yargs/yargs')
const dotenv = require('dotenv')
const path = require('path')

const registry = []

function register (what) {
  registry.push(what)
}

function run (settingsPath, argv) {
  const yargs = new Yargs()

  yargs
    .string('env')
    .describe('env', 'path to dotenv file for local development')
    .default('env', '')
    .coerce('env', value => {
      if (value && !Array.isArray(value)) {
        dotenv.config({path: path.resolve(value)})
        dotenv.load()
      }
    }).parse(argv.slice(2), () => {})

  const settings = (
    settingsPath
    ? require('../settings').load(path.resolve(settingsPath))
    : null
  )

  if (settings) {
    require('./runserver')
  }
  require('./init')

  const cmd = settings ? './bin/manage.js' : 'spife'

  const parser = registry.reduce(
    (yargs, xs) => yargs.command(xs),
    yargs.usage(`${cmd} <command>`)
  ).demand(1).strict().recommendCommands().help()

  const idx = argv.indexOf('--env')
  if (idx > -1) {
    argv.splice(idx, 2)
  }

  parser.parse(argv.slice(2), {settings})
}
