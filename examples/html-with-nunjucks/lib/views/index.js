'use strict'

const reply = require('@npm/knork/reply')

module.exports = {homepage}

function homepage (req, context) {
  return reply.template('home.html', {target: 'world'})
}
