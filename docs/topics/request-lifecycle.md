# The Spife Request Lifecycle

Spife splits request concerns into two broad categories:

* **Views** handle individual routes, while
* **Middleware** handles all requests.

**Middleware** is supplied to Spife as a list. The order is important, in that
it determines _the order of events when a client request comes in._ The
lifecycle is divided into three phases, listed below.

Between every middleware, resolved values and rejected errors will be decorated
with default status information and checked for validity. It is not valid to:

- Resolve to a false-y value from middleware. Views, however, can return
  false-y values, which will be coerced to `204 No Content` responses.
- Reject a non-error value anywhere.

## `processRequest(req, next)`

Each middleware will be called with a [spife request][ref-request] and
a `next` function, which will call the next middleware in the list.

If middleware opts not to call `next`, its return value will be used
as the response and no further middleware will be called.

`next` will return a `Promise` for the value returned by the next
middleware (or `processView` cycle.)

## `processView(req, match, context, next)`

In the `processView` stage, each middleware will again be called in order, this
time with a [`reverse.Match`][ref-reverse-match] object, `context`
[`Map`][ref-reverse-context], and a `next` function.

## Flush (handled by Spife)

Once the `processRequest` and `processView` phases have resolved into a value
or error, Spife will coerce errors into responses, and responses into `{status,
headers, stream}`.

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
object][ref-http-response] held by spife. Once complete the request/response
cycle has ended.

Any streaming errors will be re-emitted on the [`http.Server`][ref-http-server]
held by spife as `response-error` events.

[ref-request]: ../reference/request.md

[ref-server]: ../reference/server.md

[ref-reverse-match]: https://github.com/chrisdickinson/reverse#match-object

[ref-reverse-context]: https://github.com/chrisdickinson/reverse#routermatchmethodstring-routestring--match--null

[def-content-type]: https://www.w3.org/Protocols/rfc2616/rfc2616-sec14.html#sec14.17

[ref-http-response]: https://nodejs.org/api/http.html#http_class_http_serverresponse

[ref-http-server]: https://nodejs.org/api/http.html#http_class_http_server
