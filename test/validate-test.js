const t = require('tap')
const Promise = require('bluebird')
const joi = require('../joi')
const validate = require('../decorators/validate')

const context = {
  set: (key, val) => { this[key] = val; return this },
  get: (key) => { return this[key] }
}

t.test('the validateBody decorator', (t) => {
  const schema = joi.object({ name: joi.string() })
  const validator = (body) => typeof body.name === 'string'

  t.test('validates a body using a Joi schema and calls the viewFn with result', (t) => {
    const body = { name: 'npmcorp' }
    const req = { body: Promise.resolve(body) }

    const viewFn = (req, context) => {
      t.ok(req.validatedBody.then)
      t.end()
    }

    validate.body(schema)(viewFn)(req, context)
  })

  t.test('validates a body using a validator function and calls the viewFn with result', (t) => {
    const body = { name: 'npmcorp' }
    const req = { body: Promise.resolve(body) }

    const viewFn = (req, context) => {
      t.ok(req.validatedBody.then)
      t.end()
    }

    validate.body(validator)(viewFn)(req, context)
  })

  t.test('resolves validatedBody promise when body is valid', (t) => {
    const body = { name: 'npmcorp' }
    const req = { body: Promise.resolve(body) }
    const schema = joi.object({
      name: joi.string()
    })

    const viewFn = (req, context) => {
      req.validatedBody.then(() => {
        t.pass()
        t.end()
      }).catch(() => {
        t.fail('decorator rejected promise when promise should have resolved')
        t.end()
      })
    }

    validate.body(schema)(viewFn)(req, context)
  })

  t.test('rejects validatedBody promise when body is invalid', (t) => {
    const body = { name: 'npmcorp' }
    const req = { body: Promise.resolve(body) }
    const schema = joi.object({
      name: joi.number()
    })

    const viewFn = (req, context) => {
      req.validatedBody.then(() => {
        t.fail('decorator resolved promise when promise should have rejected')
        t.end()
      }).catch(() => {
        t.pass()
        t.end()
      })
    }

    validate.body(schema)(viewFn)(req, context)
  })

  t.end()
})
