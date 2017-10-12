# Patterns: Decorators

## What is a decorator?

A decorator is a higher order function. It is a function that takes a view
function and returns a view function. This new view function can perform
actions before or after the original view function. It could prevent the
original view function from executing. It could intercept and mutate the
arguments that it was provided, to change what the original view function
receives when invoked. It could simply attach a property to the original view
function and return it.

Decorators are a powerful tool for separating the concerns of a program into
discrete functions.

## What does a decorator look like?

It will look like this:

```javascript
module.exports = decorator

function decorator (viewFn) {
  return innerFn

  function innerFn (...args) {
    return viewFn(...args)
  }
}
```

If your decorator takes arguments other than the view function, it's best
to accept those in a function that _returns_ a decorator.

```javascript
module.exports = takesArgs

function takesArgs ({my, config, args}) {
  return decorator

  function decorator (viewFn) {
    return innerFn

    function innerFn (...args) {
      return viewFn(...args)
    }
  }
}
```

There are other ways to accept arguments, but Knork will attempt to stick
to the form you see above!

> **Note**:
>
> You should also use
> [`@npm/decorate`](https://www.npmjs.com/package/@npm/decorate) to return your
> `innerFn`. This will do handy things like forwarding properties from the
> `viewFn` onto the `innerFn` and making the decorator introspectable.

## Why use a decorator?

Generally, the goal of a decorator is to separate some concern out of the
original view function, such that the view function is left with a single
responsibility.

A good test to use is:

- Do I need this behavior for one view? **Put it in the view.**
- Do I need this behavior across all views? **Add some middleware.**
- Do I need this behavior across many, but not all, views? **Write a decorator.**

For example: in the npm registry, there is a package edit view that must load,
modify, and store a package. Additionally, the view should only let users who
are maintainers edit the package in question. Further, the view should validate
that the modification the user is attempting to make is valid. The **core
functionality** of the view is to load, modify, and store a package. It is
agnostic about whether the user in question is a maintainer of that package. It
is further written to be agnostic about the modifications it receives -- they
are assumed to be valid. We can do this because we use decorators to separate
concerns: this view is decorated with authorization and body validation
decorators.

## Recipes

### My site has a default behavior I'd like one or two views to opt-out of

This is a great use-case for decorators. Assume every view on your site orders
pizza before executing, but a couple of views do not require pizza to be ordered.
You could write a decorator that annotates a view with extra information:

```javascript
module.exports = viewFn => {
  viewFn.noPizzaPlease = true
  return viewFn // it's totally okay to return the original
                // viewFn from a decorator!
}
```

Then write some middleware that checks for this property before ordering pizza:

```javascript
module.exports = createPizzaOrderingMiddleware

function createPizzaOrderingMiddleware ({toppings, size}) {
  return {
    processView (req, match, context, next) {
      const view = match.controller[match.name]
      if (view.noPizzaPlease) {
        return next()
      }

      return magicPizzaOrderingAPI().then(next)
    }
  }
}
```

### I have three views on my site that need the same extra template context

This is a great opportunity to use a decorator!

You could write this as a decorator that starts fetching the extra context
at the same time as your view function:

```javascript
module.exports = myDecorator

function fetchExtraContext (viewFn) {
  return innerFn

  async function innerFn (...args) {
    const [extraContext, response] = await Promise.all([
      getSomeExtraContextSomehow(),
      viewFn(...args)
    ])

    return Object.assign(response, extraContext)
  }
}
```

It'd be handy if `extraContext` didn't crash the view if it failed to load.
It'd be handier yet if we didn't wait too long to load `extraContext`:

```javascript
module.exports = myDecorator

const delay = require('util').promisify(setTimeout)

function fetchExtraContext (viewFn) {
  return innerFn

  async function innerFn (...args) {
    const failureContext = {it: 'failed'}
    const [extraContext, response] = await Promise.all([
      Promise.race([
        getSomeExtraContextSomehow(),
        delay(1000).then(() => failureContext)
      ]).catch(() => failureContext),
      viewFn(...args)
    ])

    return Object.assign(response, extraContext)
  }
}
```
