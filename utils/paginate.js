'use strict'

const Promise = require('bluebird')

module.exports = createPaginator

class InvalidPage extends Error {
  constructor (num) {
    /* eslint-disable operator-linebreak */
    super(
      isNaN(num) ? `Expected page number to be a number, not ${num}` :
      num < 0 ? `Expected page number to be greater than zero` :
      !isFinite(num) ? `Expected page number to be finite` :
      `Bad page number ${num}`
    )
    /* eslint-enable operator-linebreak */
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
