# Ethos

Knork wants to make doing the _right_ thing the same as doing the _easy_ thing.
Knork's goal is to make creating **consistent**, **correct** RESTful APIs the
_easy_ thing.

It attempts to accomplish this by:

* Providing **thorough** documentation, covering high level concepts, guides, as
  well as reference material. _Knork can only be as useful as it is approachable._
* Curating a set of patterns and packages and presenting them through a single
  package. This flies in the face of the small module ethos _to some degree_, but
  in some cases "batteries included" is not the worst thing in the world, especially
  when trying to produce _consistent APIs_.
* Using Promises in order to retain complete control over the request/response
  cycle. Authors cannot always predict where their service will fail — it's best
  if the framework takes that into account.
* Clearly separating concerns. Depending on the scope of the change you want to
  make, there should always be a clear place to _put_ that change: be it views,
  decorators, or middleware.
