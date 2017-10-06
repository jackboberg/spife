'use strict'

const XFORM = Symbol.for('knork-template-serializer')

module.exports = {serialize, XFORM}

function serialize (obj) {
  return visit(obj)
}

function visit (obj) {
  if (obj) {
    if (typeof obj === 'object') {
      const result = Array.isArray(obj) ? visitArray(obj) : visitObject(obj)
      return result
    } else {
      return obj
    }
  } else {
    return obj
  }
}

function visitObject (obj) {
  let target = obj[XFORM] ? obj[XFORM](obj) : obj
  for (var key in target) {
    let visited = visit(target[key])
    if (visited !== target[key]) {
      if (target === obj) {
        target = Object.assign({}, obj)
      }
      target[key] = visited
    }
  }
  return target
}

function visitArray (arr) {
  let target = arr[XFORM] ? arr[XFORM]() : arr
  for (var idx = 0; idx < arr.length; ++idx) {
    let visited = visit(target[idx])
    if (visited !== target[idx]) {
      if (target === arr) {
        target = arr.slice()
      }
      target[idx] = visited
    }
  }
  return target
}
