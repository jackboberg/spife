# :fork_and_knife: Getting Started with Knork

Knork is, first and foremost, a glue package — it curates several smaller
packages and re-exports them as a whole in order to make it easier to build
small, HATEOAS-y, RESTful APIs. It provides the following functionality:

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
> > :information_source: **Some implementation information...**
>
> OR:
>
> > :warning: **Be aware of the following...**
>
> OR:
>
> > :rotating_light: **Danger! Danger! This is full of Danger!**
>
> Let's try it now:

-----------------

> :information_source: **For folks who prefer to dive in...**
> 
> If you're confident you can figure it out, and would like to hop right in,
> please check out the [reference documentation][reference-docs], which will link
> to [topical documentation][topic-docs] where appropriate. If that all looks
> like :spaghetti:, though, remember this doc is here for you! :revolving_hearts:

<a id="table-of-contents"></a>

## :books: Table of Contents

* Your First Knork
  * [Models](#models)
  * [Routes](#routes)
  * [Views](#views)
    * [Paginated Views](#paginated-views)
    * [User Input](#user-input)

## :beginner: Your First Knork

Let's build a simple knork service for sending and receiving physical
:packages:. We should be able to:

1. List packages in-flight,
2. Create new packages,
3. Update packages,
4. And mark packages as having been delivered.

To start, run the following commands in a new directory:

```
# inside of your new directory
$ npm i --save @npm/knork
$ mkdir -p lib/{models,urls,views}
$ touch lib/{models/{destination,package},urls/index,views/index}.js
```

Your directory should have the following structure. If you have the `tree`
command available, you can easily verify this by running `tree .` inside
of your new directory.

```
.
└── lib
    ├── models
    │   ├── destination.js
    │   └── package.js
    ├── urls
    │   └── index.js
    └── views
        └── index.js
```

[Table of Contents ⏎](#table-of-contents)

<a id="models"></a>

### :floppy_disk: Models

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

Now that we have a `Destination`, let's create a model for `Package`s. We'll
want to represent what `Destination` it's shipping to, a public identifier for
it, when we received it, and whether it's in transit, delivered, or lost. We'll
add the following to `lib/models/package.js`:

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

### :mount_fuji: Views

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
const http = require('knork/http')

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
    throw http.status(err, 404)               // and rethrow it, decorated with a "404" status.
  })
}

// ... snip snip ...
```

The [`knork/http` module][ref-knork-http] provides access to functions that can
decorate a response with header and status information. Objects are
transparently decorated with this information but are otherwise not modified.
Primitive values, like strings, are cast up into Streams containing their
value.

Some responses may be empty, like the result of a `DELETE` operation. Let's
take a look at how to do that:

```javascript
'use strict'

const Package = require('../models/package')
const http = require('knork/http')

// ... snip snip ...

function deletePackage (req, context) {
  return Package.objects.filter({
    public_id: context.get('package')
  }).delete().then(count => {
    // 404 if we didn't delete anything, 204 if we did.
    if (count === 0) {
      throw new http.NotFoundError()
    }
    return http.status(http.empty(), 204)
  })
}

// ... snip snip ...
```

The query looks a bit more complicated this time — we filter down to just rows
that match our desired `public_id` then call `delete()`. This corresponds to a
single query: `DELETE FROM packages WHERE public_id=$1`, which returns the
number of affected rows.

We want to 404 when nothing was deleted, and 204 otherwise. Note that we're able
to cause a 404 by **throwing** a `new http.NotFoundError()`. In general, if you
need to return a non-2XX or non-3XX response, it's best to throw these objects.

Finally, we create an empty response using `http.empty()`, give it a status
code, and return it as our ultimate response.

[Table of Contents ⏎](#table-of-contents)

<a id="paginated-views"></a>

#### :orange_book: Paginated Views

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

```
{
  "objects": [ <Package>, ],
  "total": Number,
  "urls": {
    "next": "/path/to/url?page=3",
    "prev": "/path/to/url?page=1"
  }
}
```

To control the JSON output by a `Package`, we have multiple options:

* We can specify a `toJSON` method on the `Package` class, or
* We can provide a `serialize` option to the paginator.

If you wish to control overall output of all instances of `Package`, the first
option is the way to go. Otherwise, you can use the `serialize` option.

[Table of Contents ⏎](#table-of-contents)

<a id="user-input"></a>

#### :skull: User Input





