'use strict'

module.exports = {sprout}

function sprout (list, inner, argc) {
  const args = Array.from(Array(argc)).map((_, idx) => `$${idx}`)
  const jargs = args.join(', ')

  const body = list.reduceRight((acc, xs, idx) => {
    return `$${idx + argc + 1}(${jargs}, function (${jargs}) { return ${acc} })`
  }, `$${argc}(${jargs})`)

  list.unshift(inner)
  const fnargs = list.map((_, idx) => `$${idx + argc}`)
  const allargs = [...fnargs, `
'use strict'

return function onion (${args}) {
  return ${body}
}`.trim()]

  // eslint-disable-next-line no-new-func
  return Function(...allargs)(...list)
}
