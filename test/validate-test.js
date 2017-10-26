const t = require('tap')
const Promise = require('bluebird')
const joi = require('../joi')
const validate = require('../decorators/validate')

const schema = joi.object({
  name: joi.string()
})

const context = {
  set: (key, val) => { this[key] = val; return this },
  get: (key) => { return this[key] }
}

t.test('the validateBody decorator', (t) => {
  t.test('calls the viewFn with validated body when valid', (t) => {
    const body = { name: 'npmcorp' }
    const req = { body: Promise.resolve(body) }

    const viewFn = (req, context) => {
      t.same(req.validatedBody, body)
      t.end()
    }

    const errorFn = (req, context) => {
      t.error(context.get('error'), 'decorator called errorFn. expected viewFn to be called.')
      t.end()
    }

    validate.body(schema, errorFn)(viewFn)(req, context)
  })

  t.test('calls the errorFn with error when body is invalid', (t) => {
    const body = { name: 1 }
    const req = { body: Promise.resolve(body) }

    const viewFn = (req, context) => {
      t.fail('decorator called viewFn. expected errorFn to be called.')
      t.end()
    }

    const errorFn = (req, context) => {
      t.match(context.get('error'), /must be a string/)
      t.end()
    }

    validate.body(schema, errorFn)(viewFn)(req, context)
  })

  t.test('calls straight through to viewFn when body already validated', (t) => {
    const body = { name: 'npmcorp' }
    const req = {
      validatedBody: body,
      body: () => {
        t.fail('decorator attempted to resolve req.body.then. expected to immediately call viewFn')
      }
    }

    const viewFn = (_args) => {
      t.pass()
      t.end()
    }

    const errorFn = (req, context) => {
      t.error(context.get('error'), 'decorator called errorFn. expected viewFn to be called.')
      t.end()
    }

    validate.body(schema, errorFn)(viewFn)(req, context)
  })

  t.end()
})
