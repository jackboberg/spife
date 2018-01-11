# Transaction Decorators

```javascript
const txn = require('spife/decorators/transaction')
```

Contains decorators for specifying whether wrapped functions should run
[transactionally][def-transaction] or [atomically][def-atomicity] with respect
to the database connection.

## Table of Contents

* [API](#api)
  * [Methods](#methods)

    * [txn.atomic(Function) → (Function → Promise)](#txnatomicfunction--function--promise)
    * [txn.noTransaction(Function) → (Function → Promise)](#txnnotransactionfunction--function--promise)
    * [txn.transaction(Function) → (Function → Promise)](#txntransactionfunction--function--promise)

## API

### Methods

#### `txn.atomic(Function) → (Function → Promise)`

The same as [`pg-db-session.atomic`][pg-db-session-atomic].

#### `txn.noTransaction(Function) → (Function → Promise)`

**For [view functions][topic-view] only.** Because the
[`TransactionMiddleware`][ref-transaction-mw] automatically wraps all incoming
requests in a transaction, it can occasionally be useful to note when a view
does not _need_ a transaction.

Views operating without a transaction will acquire connections up to the
maximum concurrency settings provided to the
[`DatabaseMiddleware`][ref-database-mw]. If a non-transaction-wrapped view
calls a transactional or atomic operation, a transaction will automatically be
started for the duration of that operation.

```javascript
'use strict'

const txn = require('spife/decorators/transaction')

module.exports = txn.noTransaction(req => {
  return 'no transaction started.'
})
```

#### `txn.transaction(Function) → (Function → Promise)`

The same as [`pg-db-session.transaction`][pg-db-session-transaction].

[def-transaction]: http://www.postgresql.org/docs/9.5/static/tutorial-transactions.html
[def-atomicity]: https://github.com/npm/pg-db-session#dbatomicfunction--promiset--function
[topic-view]: ../topics/views.md
[ref-transaction-mw]: ./middleware/transaction.md
[ref-database-mw]: ./middleware/database.md
[pg-db-session-atomic]: https://github.com/npm/pg-db-session#dbatomicfunction--promiset--function
[pg-db-session-transaction]: https://github.com/npm/pg-db-session#dbtransactionfunction--promiset--function
