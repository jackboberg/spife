# Knork Documentation

Welcome to Knork! It cuts like a knife, but stabs like a fork!

## About This Documentation

This documentation is split into three categories:

* **Guide**, or **tutorial**, content which exists as files in _this_ directory (`docs/`).
  * See the [getting started guide][guide-getting-started] for a tour of Knork.
  * See the [FAQ][guide-faq] for frequently asked questions.
* **Topic** content which lives in `docs/topics/`. This covers high-level
  concepts of Knork, like "What does the request/response cycle look like?"
  * See the [topic index][topic-index] for a rundown of all topics.
* **Reference** content which lives in `docs/reference`. This covers low-level
  APIs of Knork.
  * See the [reference index][ref-index] for a rundown of all topics.

Readers will occasionally see pull-quotes in the docs. They will be one of
three kinds: "informational" :information\_source:, "warning" :warning:, or
"alert!" :rotating\_light:. They will have an associated _heading_ with one
of the preceding emoji. Here's how it looks:

> :warning: **A side note on side notes:**
>
> Supplemental information will appear in block quotes such as this one, with
> a header pulled to the side. It might look like this:
>
> > :information\_source: **Some implementation information...**
>
> OR:
>
> > :warning: **Be aware of the following...**
>
> OR:
>
> > :rotating\_light: **Danger! Danger! This is full of Danger!**

All [jargon][def-jargon] terms should hyperlink to an associated definition. If
you see a jargon term that is not linked, please fix it and send a PR!

### API Docs

API docs are broken down into three sections:

1. **Definition.** This covers how to get at the module or object being documented.
2. **Types.** This lists all of the [types][def-types] provided by the object or module.
3. **Methods.** This lists all of the [functions][def-functions] provided by the object or module.

The **Methods** subheadings use the following nomenclature:

| **You See:**         | **It Means:**                                                                 |
| -------------------- | ----------------------------------------------------------------------------- |
| `obj`                | there is an object named `obj`.                                               |
| `obj.prop`           | the object `obj` has a [property][def-property], `prop`.                      |
| `obj.prop → XYZ`     | the type of `prop` is `XYZ`.                                                  |
| `obj.prop → X | Y`   | the type of `prop` is _either_ `X` **or** `Y`.                                |
| `obj.prop()`         | the property `prop` may be called as a function.                              |
| `obj.prop() → XYZ`   | the return type of `prop()` is `XYZ`.                                         |
| `CapitalCase`        | a type.                                                                       |
| `Array<T>`           | an [array][def-array] containing values of type `T`.                          |
| `Promise<T>`         | a [promise][def-promise] for a value of type `T`.                             |
| `fn(x, y)`           | a function taking two parameters, `x` and `y`.                                |
| `fn(x[, y])`         | a function taking one or two parameters, the latter parameter being optional. |
| `Type#prop`          | a property available on `Type`'s `prototype`.                                 |
| `Object<String : Y>` | an object mapping strings to values of type `Y`.                              |
| `Map<X : Y>`         | a [map][def-map] mapping values of type `X` to those of type `Y`.             |

All method docs will have a short explanation of the method, followed by a code
example of how to use the method.

Let's look at an example method:

#### `request.body → Promise<Object>`

This says that there's a `request` object, it has a `body` property, and the
type of that property is a `Promise` for an `Object`. We don't know anything
about the `Object` in particular so we haven't defined it further (like
`Object<String : Number`).

[def-jargon]: https://en.wikipedia.org/wiki/Jargon

[guide-getting-started]: ./getting-started.md

[guide-faq]: ./faq.md

[topic-index]: ./topics/README.md

[ref-index]: ./reference/README.md

[def-types]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures

[def-functions]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function

[def-property]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Properties

[def-array]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array

[def-promise]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise

[def-map]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map
