'use strict'

const chokidar = require('chokidar')

const hotRequire = require('../lib/hot-require')
const settings = require('../lib/settings')

module.exports = function createHotReload () {
  return {
    async processServer (server, next) {
      const {sources, settingsPath, projectDir} = hotRequire
      const watched = new Set()
      const watcher = chokidar.watch([...sources.keys()])

      watcher.on('change', path => {
        console.log(`changed: ${shorten(path)}`)
        for (let parent of getParents(sources, path)) {
          console.log(`clearing cache for: ${shorten(parent)}`, parent)
          delete require.cache[parent]
        }

        const {ROUTER, MIDDLEWARE} = settings.load(settingsPath)
        server.router = ROUTER
        server.middleware = MIDDLEWARE
      })

      console.log(`knork hot reload active`)

      const onHotAdd = () => {
        for (const file of sources.keys()) {
          if (!watched.has(file)) {
            watched.add(file)
            watcher.add(file)
          }
        }
      }
      process.on('knork-hot-add', onHotAdd)
      onHotAdd()

      await next(server)

      process.removeListener('knork-hot-add', onHotAdd)
      return watcher.close()

      function shorten (p) {
        return p.replace(projectDir, '.')
      }
    }
  }
}

function * getParents (sources, dependency) {
  const parents = new Set([dependency])
  let parentQueue = [...sources.get(dependency)]
  yield dependency
  while (parentQueue.length) {
    const parent = parentQueue.shift()
    if (parents.has(parent)) continue
    parents.add(parent)
    yield parent
    parentQueue = parentQueue.concat([...(sources.get(parent) || [])])
  }
}
