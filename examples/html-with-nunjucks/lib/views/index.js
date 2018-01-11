'use strict'

const reply = require('@npm/spife/reply')

module.exports = {homepage}

function homepage (req, context) {
  return reply.template('home', {target: 'world'})
}
