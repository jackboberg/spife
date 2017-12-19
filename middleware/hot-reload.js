'use strict'

const chokidar = require('chokidar')

const hotRequire = require('../lib/hot-require')

// modules to not hot reload
const BASE_BLACKLIST = [
  require.resolve('../lib/settings'),
  require.resolve('../lib/instantiate'),
  __filename
]

module.exports = function createHotReload ({ignore = []} = {}) {
  const blacklist = [...BASE_BLACKLIST, ...ignore]

  return {
    async processServer (server, next) {
      const {sources, routerPath, middlewarePaths, projectDir} = hotRequire

      const watcher = chokidar.watch([...sources.keys()])

      watcher.on('change', path => {
        console.log(`changed: ${shorten(path)}`)
        const parents = getParents(sources, path, blacklist)

        for (let parent of parents) {
          console.log(`clearing cache for: ${shorten(parent)}`)
          delete require.cache[parent]
        }

        if (parents.has(routerPath)) recreateRouter(server, routerPath)

        let middlewareUpdate = false
        middlewarePaths.forEach((pair) => {
          const [
            path,
            ,
            args = []
          ] = pair
          if (parents.has(path)) {
            console.log(`re-creating middleware: ${shorten(path)}`)
            middlewareUpdate = true
            let newMW = require(path)(...args)
            pair[1] = newMW
          }
        })
        if (!middlewareUpdate) return
        server.middleware = middlewarePaths.map(([_, mw]) => mw)
      })

      console.log(`knork hot reload active`)

      process.on('knork-hot-add', path => {
        watcher.add(path)
      })

      await next(server)
      return watcher.close()

      function shorten (p) {
        return p.replace(projectDir, '.')
      }
    }
  }
}

function recreateRouter (server, routerPath) {
  console.log('re-creating router')
  const newRouter = require(routerPath)
  server.router = newRouter
}

function getParents (sources, dependency, blacklist) {
  const parents = new Set([dependency])
  let parentQueue = [...sources.get(dependency)]

  while (parentQueue.length) {
    const parent = parentQueue.shift()
    if (parents.has(parent)) continue
    parents.add(parent)
    parentQueue = parentQueue.concat([...(sources.get(parent) || [])])
  }

  blacklist.forEach(item => parents.delete(item))

  return parents
}
