'use strict'

const {register} = require('./index.js')

register({
  command: 'runserver',
  describe: 'run the server',
  builder,
  handler
})

function builder (yargs) {
  yargs
    .boolean('debug')
    .describe('debug', 'enable long stack traces and expose traces in errors')
    .alias('d', 'debug')
}

function handler (argv) {
  console.log('UM')
}

