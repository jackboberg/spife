'use strict'

module.exports = {sprout}

const once = require('once')

function sprout (list, inner, argc) {
  const base = argc
  const args = Array.from(Array(argc)).map((_, idx) => `$${idx}`)
  const jargs = args.join(', ')

  const body = list.reduceRight((acc, xs, idx) => {
    return `$${idx + argc + 1}(${jargs}, function () { return ${acc} })`
  }, `$${argc}(${jargs})`)

  list.unshift(inner)
  const fnargs = list.map((_, idx) => `$${idx + argc}`)
  const allargs = [...fnargs, `
'use strict'

return function onion (${args}) {
  return ${body}
}`.trim()]
  return Function(...allargs)(...list)
}
