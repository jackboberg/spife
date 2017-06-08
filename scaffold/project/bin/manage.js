#!/usr/bin/env node
const path = require('path')
process.env.KNORK_SETTINGS = path.join(__dirname, '..', 'lib', 'settings')
require('@npm/knork/bin/manage.js')
