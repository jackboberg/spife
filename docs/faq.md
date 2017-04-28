# FAQ

(Fervently anticipated questions, in this case.) 

## How do I return an empty response?

You can either return `undefined`, or use
[`require('knork/reply').empty()`](./reference/reply.md#replyemptycode--response).

## How do I get a raw Postgres connection?

```javascript
'use strict'

const db = require('@npm/knork/db/session')

db.getConnection.then(pair => {
  pair.connection.query(`SELECT * FROM tables`, function () {
    pair.release() // <-- don't forget to `release()` when you're done!
  })
}) 
```

[ref-logging]: ./reference/middleware/logging.md
