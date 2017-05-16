#!/usr/bin/env node
'use strict'

const percentile = require('percentile')
const ansi = require('ansi-styles')
const table = require('table')
const fs = require('fs')

const thresholds = {
  durationSamples: [50, 100],
  queryCounts: [10, 20],
  queryMetrics: [20, 100]
}

fs.readFile(process.argv[2], 'utf8', (err, data) => {
  if (err) {
    return
  }
  const result = JSON.parse(data)

  const routeNames = Object.keys(result).sort()
  const headers = ['route name', '# called', 'duration', 'query count', 'query duration']
  const headers2 = ['', '', 'max/98th/min', 'max/98th/min', 'max/98th/min']
  const rows = routeNames.map(xs => {
    const info = {warnLevel: 0}
    const durationSamples = metrics(
      result[xs].durationSamples,
      thresholds.durationSamples,
      info
    )
    const queryCounts = metrics(
      result[xs].queryCounts,
      thresholds.queryCounts,
      info
    )
    const queryMetrics = metrics(
      result[xs].queryMetrics,
      thresholds.queryMetrics,
      info
    )
    const labelColor = ['green', 'yellow', 'red'][info.warnLevel] || 'red'
    return [
      ansi.underline.open + ansi[labelColor].open +
      xs + ansi[labelColor].close + ansi.underline.close,
      result[xs].durationSamples.length,
      durationSamples,
      queryCounts,
      queryMetrics
    ]
  })
  rows.unshift(headers2)
  rows.unshift(headers)

  return console.log(table.table(rows, {
    drawHorizontalLine (index) {
      return index === 2
    }
  }))
})

function metrics (arr, thresholds, info) {
  var max = -Infinity
  var min = Infinity
  for (var i = 0; i < arr.length; ++i) {
    max = arr[i] > max ? arr[i] : max
    min = arr[i] < min ? arr[i] : min
  }
  var perc = percentile(98, arr)

  if (max === min && min === perc) {
    return wrapThreshold(max, thresholds, info)
  }

  return [max, perc, min].map(
    xs => wrapThreshold(xs, thresholds, info)
  ).join(' / ')
}

function wrapThreshold (num, thresholds, info) {
  for (var i = 0; i < thresholds.length; ++i) {
    if (num < thresholds[i]) {
      break
    }
  }
  info.warnLevel = Math.max(info.warnLevel, i)
  const labelColor = ['green', 'yellow', 'red'][i] || 'red'
  return ansi[labelColor].open + num + ansi[labelColor].close
}
