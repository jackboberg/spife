'use strict'

const XFORM = Symbol.for('knork-template-serializer')

module.exports = {serialize, XFORM}

function serialize (obj) {
  return visit(obj, new Set())
}

function visit (obj, seen) {
  if (obj) {
    if (typeof obj === 'object') {
      const result = (
        Array.isArray(obj)
        ? visitArray(obj, new Set(seen))
        : visitObject(obj, new Set(seen))
      )
      return result
    } else {
      return obj
    }
  } else {
    return obj
  }
}

function visitObject (obj, seen) {
  if (seen.has(obj)) {
    throw new TypeError('Cannot serialize circular dependency')
  }
  seen.add(obj)
  let target = obj[XFORM] ? obj[XFORM](obj) : obj
  for (var key in target) {
    let visited = visit(target[key], seen)
    if (visited !== target[key]) {
      if (target === obj) {
        target = Object.assign({}, obj)
      }
      target[key] = visited
    }
  }
  return target
}

function visitArray (arr, seen) {
  if (seen.has(arr)) {
    throw new TypeError('Cannot serialize circular dependency')
  }
  seen.add(arr)
  let target = arr[XFORM] ? arr[XFORM]() : arr
  for (var idx = 0; idx < arr.length; ++idx) {
    let visited = visit(target[idx], seen)
    if (visited !== target[idx]) {
      if (target === arr) {
        target = arr.slice()
      }
      target[idx] = visited
    }
  }
  return target
}
