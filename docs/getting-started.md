# :fork\_and\_knife: Getting Started with Knork

Knork is, first and foremost, a glue package — it curates several smaller
packages and re-exports them as a whole in order to make it easier to build
small, [HATEOAS][hateoas]-y, [REST][rest]ful APIs. It provides the following functionality:

1. **Routing**, courtesy of [`reverse`][routing-reverse],
2. **Database access**, courtesy of [`pg`][pg]
3. **Per-request concurrency and transactions**, courtesy of
   [`pg-db-session`][pg-db-session],
4. An **ORM**, courtesy of [`ormnomnom`][ormnomnom],
5. **Metrics gathering**, courtesy of [`numbat-emitter`][numbat-emitter],
6. **Monitoring**, a la [`restify-monitor`][restify-monitor],
7. and **Logging**, courtesy of [`bole`][bole]

It ties all of this together with a promise-based [request-response
cycle][request-lifecycle].

This document will demonstrate all of the functionality of Knork while walking
through the assembly of a simple Knork service. Each section will include links
to other useful documents, and will collect other relevant links at the end of
the section.

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
>
> Let's try it now:

* * *

> :information\_source: **For folks who prefer to dive in...**
>
> If you're confident you can figure it out, and would like to hop right in,
> please check out the [reference documentation][reference-docs], which will link
> to [topical documentation][topic-docs] where appropriate. If that all looks
> like :spaghetti:, though, remember this doc is here for you! :revolving\_hearts:

<a id="table-of-contents"></a>

## :books: Table of Contents

* [:beginner: Your First Knork](#setup)
  * [:floppy\_disk: Models](#models)
  * [:busstop: Routes](#routes)
  * [:mount\_fuji: Views](#views)
    * [:orange\_book: Paginated Views](#paginated-views)
    * [:skull: User Input](#user-input)
    * [:triangular\_ruler: :evergreen\_tree: Metrics and Logging](#metrics-and-logging)
  * [:clapper: Server](#server)
    * [:art: Middleware](#middleware)

<a id="setup">

## :beginner: Your First Knork

Let's build a simple knork service for sending and receiving physical
:package:'s. We should be able to:

1. List packages in-flight,
2. Create new packages,
3. Update packages,
4. And mark packages as having been delivered.

To start, run the following commands in a new directory:

    # inside of your new directory
    $ npm i --save @npm/knork
    $ mkdir -p lib/{models,urls,views}
    $ touch lib/{server,models/{destination,package},urls/index,views/index}.js

Your directory should have the following structure. If you have the `tree`
command available, you can easily verify this by running `tree .` inside
of your new directory.

    .
    └── lib
        ├── server.js
        ├── models
        │   ├── destination.js
        │   └── package.js
        ├── urls
        │   └── index.js
        └── views
            └── index.js

Make sure you have Postgres installed — follow \[the steps
here]\[ormnomnom-install-postgres] to make sure you have it available. Once you
have it, run `createdb knork_example`, and then run the following inside of
`psql knork_example`:

```sql
> CREATE TABLE "destinations" (
  id serial,
  name text not null,
  slug text unique not null,
  address text not null,
  created date
);
> CREATE TABLE "packages" (
  id serial,
  public_id varchar(36) unique not null,
  destination_id integer not null references destinations(id),
  contents text not null,
  status text,
  received date
);
```

Type `\q` and hit enter to exit the shell.

\[Table of Contents ⏎](#table-of-contents)

<a id="models"></a>

### :floppy\_disk: Models

Models let us represent rows of a given SQL table as instances of a class, and
operate on tables using a "Data Access Object", or "DAO" for short.

Let's start by defining the `Destination` model in `lib/models/destination.js`.
We need to be able to represent a destination for a :package: with a name, a
url-safe name, an address, and we'd like to track when we created the
destination.

```javascript
'use strict'

module.exports = Destination

const orm = require('knork/orm')
const joi = require('knork/joi')

// This class function will be called whenever we
// need to materialize a database row.
function Destination (opts) {
  Object.assign(this, {
    id: opts.id,
    name: opts.name,
    slug: opts.slug,
    address: opts.address,
    created: opts.created
  })
}

// Define the schema here using joi. The table name will be
// inferred from the class name.
//
// NB: This is the DAO we referred to above.
Destination.objects = orm(Destination, {
  id: joi.number().integer().greater(0).required(),
  name: joi.string().min(1).max(576).required(),
  slug: joi.string().regex(/^[\w\-]+$/).required(),
  address: joi.string(),
  created: joi.date().default(() => new Date(), 'current date')
})
```

> :information\_source: **Why not `class`?**
>
> In the model example above, you may have noticed that we're using
> the old-style "function declaration" method of defining a class. ES2015
> introduces a `class` keyword which makes defining a class a bit more
> straightforward, especially when it comes to inheritence. However, function
> declarations have one important property that `class`'s do not: they are
> _hoisted_ to the beginning of the scope in which they are defined.
>
> This behavior helps us avoid circular dependency problems in Node. Until
> Node gains first-class support for ES2015 module syntax, if we wish to
> avoid circular dependencies without a [compilation step][babel], we have
> to use function declarations.

Now that we have a `Destination`, let's create a model for `Package`s. We'll
want to represent what `Destination` it's shipping to, a public identifier for
it, when we received it, and whether it's in transit, delivered, or lost. Oh —
and the contents of the thing we're shipping. We'll add the following to
`lib/models/package.js`:

```javascript
'use strict'

module.exports = Destination

const Promise = require('bluebird')
const orm = require('knork/orm')
const joi = require('knork/joi')
const uuid = require('uuid')

const Destination = require('./destination')

function Package (opts) {
  Object.assign(this, {
    id: opts.id,
    public_id: opts.public_id,
    _destination: opts.destination, // store "destination" as "_destination"
    destination_id: opts.destination_id,
    contents: opts.contents,
    status: opts.status,
    received: opts.received
  })
}

Package.prototype = {
  // this is just some language-level housekeeping!
  get constructor () { return Package },

  // Add a destination getter that returns a promise for the destination.
  // If we already have a cached one, return a resolved promise, otherwise
  // request a destination and cache it once we have it!
  get destination () {
    if (this._destination) {
      return Promise.resolve(this._destination)
    }
    return Destination.objects.get({id: this.destination_id})
      .then(dst => this._destination = dst)
  }
}

Package.objects = orm(Package, {
  id: joi.number().integer().greater(0).required(),
  public_id: joi.string().guid().default(uuid.v4, 'uuid v4').required(),
  destination: orm.fk(Destination),
  contents: joi.string(),
  status: joi.any().only([
    'in-transit',
    'delivered',
    'lost'
  ]).default('in-transit'),
  received: joi.date().default(() => new Date(), 'current date')
})
```

Easy as that — we have a `Package` with a foreign key to `Destination`.
We can totally build an API around this!

[Table of Contents ⏎](#table-of-contents)

<a id="routes"></a>

### :busstop: Routes

Knork divides functionality between **views**, **routes**, and **models**.
**Models** handle the state of the service, **views** receive requests from
users and rephrase them into database operations, and **routes** glue URLs to
**views**. It's usually easiest to define your models and routes first, then
build out the views to support them in a piecemeal fashion.

Knork provides routing by way of the [reverse][routing-reverse] package, which
emphasizes writing readable URL patterns. Open up `lib/urls/index.js` and let's
define some URLs!

```javascript
'use strict'

const routing = require('knork/routing')
const joi = require('knork/joi')

module.exports = createRoutes

function createRoutes () {
  // create parameter validators
  const package = routing.param(
    'package',
    joi.string().guid().required()
  )

  // Routes are defined as "method route name". Whitespace in between
  // is ignored. The routing template tag returns a function, which
  // accepts an object mapping names to view functions — in this case,
  // we'll define our views as the exports of "require('../views')"!
  return routing`
    GET     /packages/package/${package}  viewPackage
    POST    /packages/package/${package}  updatePackage
    DELETE  /packages/package/${package}  deletePackage
    POST    /packages/new                 createPackage
    GET     /packages                     listPackages
  `(require('../views'))
}
```

Reverse will do an initial regex match on incoming request urls, matching
substitutions with by asking "give me everything that's not a '/'". It then
passes those parameters through a querystring parser — to turn, for example,
'%40' into '@'. Finally, it validates the substring using the validator
attached to the parameter. If all of these steps pass for all parameters AND
the request method matches, the route is matched. Knork will take that match
and call the associated view.

[Table of Contents ⏎](#table-of-contents)

<a id="views"></a>

### :mount\_fuji: Views

A Knork **view** is simply a function that takes a [Knork Request
object][ref-knork-request] and a Map of context values as parameters, and
returns a value, a promise for a value, or a stream. The function is run as
part of a promise chain, so exceptions will always be caught and handled by
Knork itself — materializing as "500 Internal Server Error" responses.

Let's open `lib/views/index.js` and write some views:

```javascript
'use strict'

// the names here are mapped to the names we chose in
// lib/urls/index.js.
module.exports = {
  viewPackage,
  createPackage,
  updatePackage,
  deletePackage,
  listPackages
}

function viewPackage (req, context) {
  return 'hello world'
}

function createPackage (req, context) {
  return 'hello world'
}

function updatePackage (req, context) {
  return 'hello world'
}

function deletePackage (req, context) {
  return 'hello world'
}

function listPackages (req, context) {
  return 'hello world'
}
```

For now, all of our views simply return the string "hello world". Knork
will handle turning this into a `content-type: text/plain, 200 OK` response.
Let's edit this so that we have more functional views, starting with `viewPackage`:

```javascript
'use strict'

const Package = require('../models/package')

module.exports = {
  viewPackage,
  createPackage,
  updatePackage,
  deletePackage,
  listPackages
}

function viewPackage (req, context) {
  return Package.objects.get({
    public_id: context.get('package')
  })
}
```

Et Voilà! We use the `Package` model's DAO to fetch packages matching the
context parameter from `lib/urls/index.js`. Knork will call `JSON.stringify` on
the resulting object. But what if there are no packages with that `public_id`?
Without any further specification, errors received by Knork are given a `500`
status code. We'd like to be more specific than that, so let's handle that:

```javascript
'use strict'

const Package = require('../models/package')
const reply = require('knork/reply')

module.exports = {
  viewPackage,
  createPackage,
  updatePackage,
  listPackages
}

function viewPackage (req, context) {
  return Package.objects.get({
    public_id: context.get('package')
  }).catch(Package.objects.NotFound, err => { // catch only "NotFound" exceptions...
    throw reply.status(err, 404)              // and rethrow it, decorated with a "404" status.
  })
}

// ... snip snip ...
```

The [`knork/reply` module][ref-knork-reply] provides access to functions that can
decorate a response with header and status information. Objects are
transparently decorated with this information but are otherwise not modified.
Primitive values, like strings, are cast up into Streams containing their
value.

Some responses may be empty, like the result of a `DELETE` operation. Let's
take a look at how to do that:

```javascript
'use strict'

const Package = require('../models/package')
const reply = require('knork/reply')

// ... snip snip ...

function deletePackage (req, context) {
  return Package.objects.filter({
    public_id: context.get('package')
  }).delete().then(count => {
    // 404 if we didn't delete anything, 204 if we did.
    if (count === 0) {
      throw new reply.NotFoundError()
    }
    return reply.status(reply.empty(), 204)
  })
}

// ... snip snip ...
```

The query looks a bit more complicated this time — we filter down to just rows
that match our desired `public_id` then call `delete()`. This corresponds to a
single query: `DELETE FROM packages WHERE public_id=$1`, which returns the
number of affected rows.

We want to 404 when nothing was deleted, and 204 otherwise. Note that we're able
to cause a 404 by **throwing** a `new reply.NotFoundError()`. In general, if you
need to return a non-2XX or non-3XX response, it's best to throw these objects.

Finally, we create an empty response using `reply.empty()`, give it a status
code, and return it as our ultimate response.

[Table of Contents ⏎](#table-of-contents)

<a id="paginated-views"></a>

#### :orange\_book: Paginated Views

Invariably, in every web service there are common views on data, and it's handy
to be consistent in how those common views respond to user requests. For
example, most APIs will eventually have to tackle a common paginated list
format. Knork provides for this with the paginated view. Let's see how this
applies to our "List packages" endpoint:

```javascript
'use strict'

const paginate = require('knork/views/paginate')
const Package = require('../models/package')

// ... snip snip ...

function listPackages (req, context) {
  return paginate(req, context, {
    queryset: Package.objects.all()
  })
}

// ... snip snip ...
```

That's all it takes — you have a fully paginated list endpoint. Responses
will be in the form:

    {
      "objects": [ <Package>, ],
      "total": Number,
      "urls": {
        "next": "/path/to/url?page=3",
        "prev": "/path/to/url?page=1"
      }
    }

To control the JSON output by a `Package`, we have multiple options:

* We can specify a `toJSON` method on the `Package` class, or
* We can provide a `serialize` option to the paginator.

If you wish to control overall output of all instances of `Package`, the first
option is the way to go. Otherwise, you can use the `serialize` option.

[Table of Contents ⏎](#table-of-contents)

<a id="user-input"></a>

#### :skull: User Input

We're well on our way to a functioning "package management" API, but we're
missing one _important_ detail: a way to register new packages! In order to add
a package to our system, our [model][model] requires that clients provide us
with the contents of the package and the package's destination.

However, clients are wiley folk — we don't want to accept just _any_ package
contents. We only want to ship to valid destinations, and we only want to ship
packages smaller than a certain size. If the user has already registered a
destination with us before, we'd like them to be able to give us a `slug`
instead of the full data. [Joi][] can help us out with that. Let's create
a schema at the top of `lib/views/index.js`:

```javascript
'use strict'

const joi = require('knork/joi')

const Destination = require('../models/destination')
const Package = require('../models/package')

const createPackageSchema = joi.object().keys({
  contents: joi.string().max(200).required(),
  destination: joi.any().valid([
    joi.object({
      name: joi.string().max(200).required(),
      address: joi.string().max(200).required()
    }),
    joi.string().min(1)
  ])
})

module.exports = {
  viewPackage,
  createPackage,
  updatePackage,
  deletePackage,
  listPackages
}

// ... snip snip ...
```

Knork makes it easy to attach Joi schemas to individual views. To do so, we
make use of the [`knork/decorators/validate`][ref-knork-validate] module;
specifically the `body` method:

```javascript
'use strict'

const validate = require('knork/decorators/validate')
const joi = require('knork/joi')

const Destination = require('../models/destination')
const Package = require('../models/package')

const createPackageSchema = joi.object().keys({
  contents: joi.string().max(200).required(),
  destination: joi.any().valid([
    joi.object({
      name: joi.string().max(200).required(),
      address: joi.string().max(200).required()
    }),
    joi.string().min(1)
  ])
})

module.exports = {
  viewPackage,
  createPackage: validate.body(createPackageSchema, createPackage),
  updatePackage,
  deletePackage,
  listPackages
}

// ... snip snip ...

function createPackage (req, context) {
  return 'hello world'
}
```

`validate.body` is a [decorator][def-decorator]; a _decorator_ is a function
that takes another function as input and returns a new function that may call
the original function when executed. In this case, `validate.body` will call
the original `createPackage` view if and only if the body of the incoming
request is valid according to the Joi schema we've provided. If the request
is:

* too large, then we'll return a 413 error; or
* invalid json, then we'll return a 400 error; or
* doesn't validate, then we'll return a 400 error about what went wrong.

If the request validates, the original view will be called with the request
and context, and the request will have a `validatedBody` attribute containing
a promise for the validated data.

From this, we can finish our Package creation API:

```javascript
// ... snip snip ...

const rethrow = require('knork/utils/rethrow')
const reply = require('knork/reply')

const urls = require('../urls')

function createPackage (req, context) {
  const getDestination = req.validatedBody.get('destination').then(data => {
    return (
      typeof data === 'string'
      ? Destination.objects.get({slug: data})
      : Destination.objects.getOrCreate({ // Note 1
          slug: data.name
            .toLowerCase()
            .replace(/[^\w-]/g, '-')
            .replace(/-+/g, '-'),
          name: data.name,
          address: data.address
        }).get(1)
    )
  })

  const createPackage = Package.objects.create({
    contents: req.validatedBody.get('contents'),
    destination: getDestination // Note 0
  })

  // return a 201 created with a location header that
  // points to the newly created package url. 
  const sendCreatedResponse = createPackage.then(pkg => {
    return reply(reply.empty(), 201, { // Note 2
      location: urls().reverse('viewPackage', { // Note 3
        package: pkg.public_id
      })
    })
  })

  // if the destination was provided as a string but cannot 
  // be found, rethrow that error as a 424 "failed dependency"
  return sendCreatedResponse.catch( // Note 4
    Destination.objects.NotFound,
    rethrow(404)
  )
}

// ... snip snip ...
```

This is a pretty meaty view! Some highlights, corresponding to the notes above:

* :zero: We are passing a **promise for a destination** to `Package.objects.create`,
  [without waiting for the destination to resolve][ormnomnom-resolution];
* :one: That destination promise uses [`getOrCreate`][ormnomnom-getorcreate] to
  obtain the destination row;
* :two: We create [an empty response with a location header][ref-knork-reply];
* :three: The location header uses the routes we defined in `lib/urls/index.js`
  [to create a full URL][reverse-reverse];
* :four: We catch potential database-level errors and explicitly cast them
  [to HTTP errors][bluebird-catch-clause].

> :warning: **What if `Package` creation fails?**
>
> Astute readers might have noticed a flaw in our view: what if `Package`
> creation fails? In that case it would seem that `Destination`'s could be
> created without an associated `Package` — a minor leak, but a blemish
> nonetheless.
>
> Luckily, Knork runs all views wrapped inside of transactions by default. If
> the promise returned by a view is _rejected_, the entire transaction will be
> rolled back.
>
> Authors are encouraged to always throw errors in exceptional cases. Errors
> without associated status codes will be treated as 500 errors — if a more
> specific code is desired, authors should catch and rethrow them as in the
> above example.

[Table of Contents ⏎](#table-of-contents)

<a id="metrics-and-logging"></a>

#### :triangular\_ruler: :evergreen\_tree: Metrics and Logging

We may wish to _measure_ some aspect of the object creation. Luckily, as
long as `req` is present, metrics are just a stone's throw away:

    // ... snip snip ...

    function createPackage (req, context) {
      const getDestination = req.validatedBody.get('destination').then(data => {
        if (typeof data === 'string') {
          req.metric({
            name: 'createpackage.used_string'
          })
        }
    // ... snip snip ...

This data will be handed to [a `numbat-emitter` instance][numbat-emitter]
specifically configured for your Knork server — easy as that!

[Table of Contents ⏎](#table-of-contents)

<a id="server"></a>

### :clapper: Server

[Table of Contents ⏎](#table-of-contents)

<a id="middleware"></a>

#### :art: Middleware

[hateoas]: https://en.wikipedia.org/wiki/HATEOAS

[rest]: https://en.wikipedia.org/wiki/Representational_state_transfer

[routing-reverse]: https://github.com/chrisdickinson/reverse

[pg]: https://github.com/brianc/node-postgres

[pg-db-session]: https://github.com/npm/pg-db-session

[ormnomnom]: https://github.com/chrisdickinson/ormnomnom

[numbat-emitter]: https://github.com/ceejbot/numbat-emitter

[restify-monitor]: https://github.com/npm/restify-monitor

[bole]: http://github.com/rvagg/bole

[request-lifecycle]: ./topics/lifecycle.md

[topic-docs]: ./topics

[reference-docs]: ./ref

[ormnomnom-install-postgres]: https://github.com/chrisdickinson/ormnomnom/blob/1de3c2fc89136745436e0cc38ed6bc919e699bbc/docs/getting-started.md#getting-postgres

[babel]: https://babeljs.io/

[ref-knork-request]: ./reference/request.md

[ref-knork-reply]: ./reference/reply.md

[model]: #models

[joi]: https://github.com/hapijs/joi

[ref-knork-validate]: ./ref/decorators.md#validate

[def-decorator]: https://medium.com/google-developers/exploring-es7-decorators-76ecb65fb841#.dnzdeh2v6

[ormnomnom-resolution]: https://github.com/chrisdickinson/ormnomnom/blob/master/docs/making-queries.md#basic-querying

[ormnomnom-getorcreate]: https://github.com/chrisdickinson/ormnomnom/blob/master/docs/ref/dao.md#daomodelgetorcreateobject--promiseboolean-model

[reverse-reverse]: https://github.com/chrisdickinson/reverse#routerreversenamestring-argsobject--string--null

[bluebird-catch-clause]: http://bluebirdjs.com/docs/api/catch.html
