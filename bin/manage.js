#!/usr/bin/env node
'use strict'

const {run} = require('../lib/commands')

run(process.env.KNORK_SETTINGS, process.argv)
