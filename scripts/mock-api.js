const util = require('util')
const fs = require('fs')
const express = require('express')
const FIXTURES_DIRECTORY = `${__dirname}/../fixtures`
const readdir = util.promisify(fs.readdir)

function createRoutesFromDirectory (directory, withRoutes = {}) {
  return readdir(`${FIXTURES_DIRECTORY}/${directory}`)
    .then((routes) => {
      return Promise.all(routes.map(route => readdir(`${FIXTURES_DIRECTORY}/${directory}/${route}`)))
        .then((resources) => {
          return routes.reduce((prev, curr, i) => {
            const path = `${directory}/${curr}/${resources[i]}`

            prev[decodeURIComponent(`/${path}`)] = (_, res) => {
              res.type('application/json+ld')
              res.sendFile(`${path}`, { root: FIXTURES_DIRECTORY })
            }

            return prev
          }, withRoutes)
        })
    })
}

/**
 * Creates a mocked API via the files given in `fixtures`
 * For now it reads the `_` and `component` directories
 * and declares routes matching file names
 */
function createApi () {
  const app = express()

  return createRoutesFromDirectory('_')
    .then((routes) => {
      return createRoutesFromDirectory('component', routes)
    })
    .then((routes) => {
      for (const route in routes) {
        app.get(route, routes[route])
      }

      return app
    })
}

module.exports = createApi

if (process.env.API_PORT) {
  createApi()
    .then((app) => {
      app.listen(process.env.API_PORT)
    })
}
