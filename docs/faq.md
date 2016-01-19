# FAQ

(Fervently anticipated questions, in this case.) 

## How do I return an empty response?

Return [`require('knork/reply').empty()`](./reference/reply.md#replyempty--response).

## How do I get a raw Postgres connection?

```javascript
const db = require('knork/db/session')

db.getConnection.then(pair => {
  pair.connection.query(`SELECT * FROM tables`, function () {
    pair.release() // <-- don't forget to `release()` when you're done!
  })
}) 
```
