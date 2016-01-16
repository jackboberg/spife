'use strict'

const Promise = require('bluebird')

module.exports = createPaginator

class InvalidPage extends Error {
  constructor (num) {
    super(
      isNaN(num) ? `Expected page number to be a number, not ${num}` :
      num < 0 ? `Expected page number to be greater than zero` :
      !isFinite(num) ? `Expected page number to be finite` :
      `Bad page number ${num}`
    )
    Error.captureStackTrace(this, InvalidPage)
  }
}

class OutOfRange extends Error {
  constructor (num, max) {
    super(
      `Expected page to fall within range [0, ${max}], got ${num}`
    )
    Error.captureStackTrace(this, OutOfRange)
  }
}

createPaginator.InvalidPage = InvalidPage
createPaginator.OutOfRange = OutOfRange

function createPaginator (queryset, perPage) {
  return new Paginator(queryset, perPage)
}

class Paginator {
  constructor (queryset, perPage) {
    this.queryset = queryset
    this.perPage = perPage
  }

  page (pageNo) {
    return Promise.try(() => {
      if (isNaN(pageNo) || pageNo < 0 || !isFinite(pageNo)) {
        throw new InvalidPage(pageNo)
      }
      pageNo = Number(pageNo)
      const getCount = this.queryset.count()
      const getObjects = this.queryset.slice(
        pageNo * this.perPage,
        this.perPage + pageNo * this.perPage
      )
      return Promise.join(
        getObjects,
        getCount
      ).spread((objects, count) => {
        count = Number(count)
        const maxPage = Math.floor(count / this.perPage)
        if (maxPage < pageNo) {
          throw new OutOfRange(pageNo, maxPage)
        }
        return new Page(objects, count, pageNo, maxPage)
      })
    })
  }
}

class Page {
  constructor (objects, total, pageNo, maxPage) {
    this.total = total
    this.objects = objects
    this.maxPage = maxPage
    this.pageNumber = pageNo
    if (process.env.DEBUG) this.doc = HELP
  }

  static get doc () {
    return HELP
  }

  get hasNext () {
    return this.pageNumber + 1 <= this.maxPage
  }

  get hasPrev () {
    return this.pageNumber - 1 > -1
  }

  get prev () {
    return this.pageNumber - 1
  }

  get next () {
    return this.pageNumber + 1
  }
}

const HELP = `
# Paginator

Given an [ORMnomnom QuerySet][queryset] and a number of objects to
return per page, return a paginator that can look up "pages" of objects.
Each Page has a slice of the queryset, and methods for looking up the
next and previous pages, if any.

  const Paginator = require('./lib/utils/paginate.js')

  const paginator = Paginator(
    User.objects.filter({'deleted:isNull': true}),
    15
  )
  paginator.page(1).then(page => {
    console.log(page.total)
    console.log(page.maxPage)
    console.log(page.pageNumber)
    console.log(page.objects)
    if (page.hasNext()) {
      console.log(page.next())
    }
    if (page.hasPrev()) {
      console.log(page.prev())
    }
  }).catch(Paginator.InvalidPage, err => console.log('bad page number!')
    .catch(Paginator.OutOfRange, err => console.log('page not in range!')

## API

### Paginator(qs:QuerySet, perPage:Number) → new Paginator

Create a new paginator for a given queryset. The queryset will not be 
evaluated until `.page()` is run.

### Paginator#page(page:Number) → Promise<Page>

Look up a given page by page number.

### Page

* total:Number — the total number of objects
* maxPage:Number — the maximum valid page number
* pageNumber:Number — this page's number
* objects:Array — an array of the objects for the page.

#### Page#hasNext() → Boolean, Page#hasPrev() → Boolean

Are there pages before this page? After this page?

#### Page#next() → Number, Page#prev() → Number

The number of the previous and next pages, respectively.

[queryset]: https://github.com/chrisdickinson/ormnomnom/blob/master/docs/ref/queryset.md
`

if (process.env.DEBUG) {
  createPaginator.doc = HELP
}
