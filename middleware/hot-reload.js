'use strict'

const chokidar = require('chokidar')

const hotRequire = require('../lib/hot-require')
const settings = require('../lib/settings')

module.exports = createHotReload

function createHotReload ({log = console.log} = {}) {
  return {
    async processServer (server, next) {
      const {sources, settingsPath, projectDir} = hotRequire
      const watched = new Set()
      const watcher = chokidar.watch([])

      watcher.on('change', path => {
        log(`changed: ${path.replace(projectDir, '.')}`)
        for (let parent of getParents(sources, path)) {
          log(`clearing cache for: ${parent.replace(projectDir, '.')}`, parent)
          delete require.cache[parent]
        }

        try {
          const {ROUTER, MIDDLEWARE} = settings.load(settingsPath)
          server.router = ROUTER
          server.middleware = MIDDLEWARE
        } catch (err) {
          log('caught error during hot reload:')
          log(err.stack || err.message || err)
        }
      })

      log(`knork hot reload active`)

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
