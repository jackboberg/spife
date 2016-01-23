# The Knork Request Lifecycle

Knork splits request concerns into two broad categories:

* **Views** handle individual routes, while
* **Middleware** handles all requests.

**Middleware** is supplied to Knork as a list. The order is important, in that
it determines _the order of events when a client request comes in._ The lifecycle
is divided into 7 phases, listed below. 

> :warning: **re: "skip"** 
>
> Where the instructions say "skip", that means that remaining middleware in
> the step should not execute and execution will proceed directly to the noted
> phase.

<a id="request"></a>

## :one: `Request` middleware

Executed from the first middleware to the last. Any middleware that has a
`processRequest` method will execute. Middleware lacking a `processRequest`
will be skipped. `processRequest` will be called with a [knork
request][ref-request] as the first parameter.

* If any `processRequest` returns a truthy promise from that middleware, it
  will be treated as the response, and we'll skip to **[the response middleware phase (:five:)](#response)**.
* If any `processRequest` throws an error or returns a rejected promise, it
  will be treated as an error and we'll skip to **[the error middleware phase (:six:)](#error)**.
* Otherwise, continue to **[view resolution (:two:)](#view-resolution)**.

<a id="view-resolution"></a>

## :two: `View` resolution

Resolve the view using the [`urls` passed to the the knork server][ref-server].
The matched view will be attached to the `match` object that will be passed
to middleware as `match.execute() → Promise<Response>`.

* If the given route does not match a url known to knork, a 404 error will
  be thrown and we'll skip to **[the error middleware phase (:six:)](#error).**
* If the route exists but does not have an assocatied view, a 501 error will
  be thrown and we'll skip to **[the error middleware phase (:six:)](#error).**
* Otherwise, continue to **[the view middleware phase (:three:)](#view-middleware)**.

<a id="view-middleware"></a>

## :three: `View` middleware

Executed from the first middleware to the last. Any middleware that has a
`processView` method will execute. Middleware lacking a `processView` will be
skipped. `processView` will be called with a [knork-request][ref-request], a
[`reverse.Match`][ref-reverse-match], and a [context map][ref-reverse-context].

* If any `processView` returns a truthy value, it will be treated as the
  response, and we'll skip to **[the response middleware phase (:five:)](#response)**.
* If any `processView` throws an error or returns a rejected promise, it
  will be treated as an error and we'll skip to **[the error middleware phase (:six:)](#error)**.
* Otherwise, proceed to **[view execution (:four:)](#view-execution)**.

<a id="view"></a>

## :four: `View` execution

The view will be executed using `match.execute()`, passing the [knork
request][ref-request] and the [context map][ref-reverse-context] from the route
match.

* If the view throws an error or returns a rejected promise, it will be
  treated as an error and we'll skip to **[the error middleware phase (:six:)](#error)**.
* Otherwise, **any** value or promise for a value returned by the view will
  be treated as the current response. Continue to **[the response middleware phase (:five:)](#response)**.

<a id="response">

## :five: `Response` middleware

Executed in **reverse order**, from the last middleware to the first. Any
middleware that has a `processResponse` will execute. Middleware lacking
a `processResponse` will be skipped.

* If any `processResponse` returns a truthy value, it will be treated as
  the response, and we'll skip to **[the flush phase (:seven:)](#flush)**.
* If any `processResponse` throws an error or returns a rejected promise,
  it will be treated as an error and we'll skip to **[the error middleware phase (:six:)](#error)**.
* Otherwise, continue to **[the flush phase (:seven:)](#flush)** with the current response.

<a id="error"></a>

## :six: `Error` middleware

If no error has occurred, continue to **[the flush phase (:seven:)](#flush)**.

Executed in **reverse order**, from the last middleware to the first. Any
middleware that has a `processError` will execute. Middleware lacking
a `processError` will be skipped.

* If any `processError` returns a truthy value, it will be treated as the
  response and we'll skip to **[the flush phase (:seven:)](#flush)**.
* If any `processError` throws an error or returns a rejected promise, it
  will be treated as the final error and we'll skip to **[the flush phase (:seven:)](#flush)**.
* Otherwise, proceed to **[the flush phase (:seven:)](#flush)** with the current error.

## :seven: Flush

Resolve all response and error promises. Coerce errors into responses, and
responses into `{status, headers, stream}`.

* If the response has `.pipe`, it will be used as `stream` directly.
* If the response is a string, it will be turned into a `text/plain`
  response stream and set the appropriate [`content-type`
  header][def-content-type] if no other `content-type` header is set.
* If the response is a buffer, it will be turned into a
  `applicaton/octet-stream` response stream and set the appropriate
  `content-type` header if no other `content-type` header is set.
* If the response is an object, it will be passed to `JSON.stringify`, and
  the result will be turned into a `application/json` response stream, setting
  the appropriate `content-type` header if no other `content-type` header is
  set.

The response stream is then piped to the [HTTP response
object][ref-http-response] held by knork. Once complete the request/response
cycle has ended.

Any streaming errors will be re-emitted on the [`http.Server`][ref-http-server]
held by knork as `response-error` events.

[ref-request]: ../reference/request.md

[ref-server]: ../reference/server.md

[ref-reverse-match]: https://github.com/chrisdickinson/reverse#match-object

[ref-reverse-context]: https://github.com/chrisdickinson/reverse#routermatchmethodstring-routestring--match--null

[def-content-type]: https://www.w3.org/Protocols/rfc2616/rfc2616-sec14.html#sec14.17

[ref-http-response]: https://nodejs.org/api/http.html#http_class_http_serverresponse

[ref-http-server]: https://nodejs.org/api/http.html#http_class_http_server
