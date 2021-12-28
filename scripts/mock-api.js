const util = require('util')
const fs = require('fs')
const path = require('path')
const express = require('express')
const FIXTURES_DIRECTORY = path.resolve(__dirname, `..`, `fixtures`)
const readdir = util.promisify(fs.readdir)

async function createRoutes(directory = null, withRoutes = {}) {
  const nestedPath = directory ? path.join(FIXTURES_DIRECTORY, directory) : FIXTURES_DIRECTORY

  const routes = await readdir(nestedPath)

  for (const route of routes)
  {
    const basePath = path.join(directory || '/', route)
    const file = path.resolve(nestedPath, route)
    const stat = fs.statSync(file)
    if (stat.isDirectory()) {
      await createRoutes(basePath, withRoutes)
    } else {
      // file that should be an endpoint
      const endpoint = decodeURIComponent(basePath)
      withRoutes[endpoint] = (req, res) => {
        res.type('application/json+ld')
        res.setHeader('link', '<http://localhost:' + process.env.API_PORT + '/docs.jsonld>; rel="http://www.w3.org/ns/hydra/core#apiDocumentation"') // ,<http://localhost:' + process.env.API_PORT + '/.well-known/mercure>; rel="mercure"
        res.setHeader('Access-Control-Allow-Origin', req.get('origin') || 'http://localhost:3000')
        res.setHeader('Access-Control-Allow-Credentials', 'true')
        res.sendFile(`${file}`, { root: null })
      }
      if (endpoint.endsWith('.jsonld')) {
        withRoutes[endpoint.slice(0, -7)] = withRoutes[endpoint]
      }
    }
  }
  return withRoutes
}

/**
 * Creates a mocked API via the files given in `fixtures`
 * For now it reads the `_` and `component` directories
 * and declares routes matching file names
 */
function createApi() {
  const app = express()

  return createRoutes()
    .then((routes) => {
      console.log('Mock endpoints...', Object.keys(routes))
      for (const route in routes) {
        app.get(route, routes[route])
      }
      app.get('/', routes['/index'])

      app.get('*', (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', req.get('origin') || 'http://localhost:3000')
        res.setHeader('Access-Control-Allow-Credentials', 'true')
        res.status(404).send('Not Found')
      })

      return app
    })
}

module.exports = createApi

if (process.env.API_PORT) {
  createApi().then((app) => {
    app.listen(process.env.API_PORT)
  })
}
