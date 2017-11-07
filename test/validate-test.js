const t = require('tap')
const Promise = require('bluebird')
const joi = require('../joi')
const validate = require('../decorators/validate')

const context = {
  set: (key, val) => { this[key] = val; return this },
  get: (key) => { return this[key] }
}

t.test('the validateBody decorator', (t) => {
  t.test('calls the viewFn with validated body promise', (t) => {
    const body = { name: 'npmcorp' }
    const req = { body: Promise.resolve(body) }
    const schema = joi.object({
      name: joi.string()
    })

    const viewFn = (req, context) => {
      t.ok(req.validatedBody.then)
      t.end()
    }

    validate.body(schema)(viewFn)(req, context)
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

  t.test('calls straight through to viewFn when body already validated', (t) => {
    const body = { name: 'npmcorp' }
    const req = {
      validatedBody: body,
      body: () => {
        t.fail('decorator attempted to resolve req.body.then. expected to immediately call viewFn')
      }
    }
    const schema = joi.object({
      name: joi.number()
    })

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
