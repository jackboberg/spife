'use strict'

module.exports = {sprout}

function sprout (list, inner, argc) {
  const args = Array.from(Array(argc)).map((_, idx) => `$${idx}`)
  const jargs = args.join(', ')

  const body = list.reduceRight((acc, xs, idx, all) => {
    return `
${acc}
const $${idx + argc}_n = (${jargs}) => $${idx + argc + 1}(${jargs}, $${idx + argc + 1}_n)
    `.trim()
  }, `const $${list.length + argc}_n = (${jargs}) => $${list.length + argc}(${jargs})`)
  list.push(inner)

  const fnargs = list.map((_, idx) => `$${idx + argc}`)
  const allargs = [...fnargs, `
'use strict'

${body}
return (${jargs}) => $${argc}(${jargs}, $${argc}_n)
`.trim()]

  // eslint-disable-next-line no-new-func
  return Function(...allargs)(...list)
}
