const util = require('util')
const fs = require('fs')
const path = require('path')
const express = require('express')
const bodyParser = require('body-parser')
const consola = require('consola')
const cookieParser = require('cookie-parser')

const FIXTURES_DIRECTORY = path.resolve(__dirname, `..`, `fixtures`)
const readdir = util.promisify(fs.readdir)

async function createRoutes(directory = null) {
  const withRoutes = []
  const nestedPath = directory
    ? path.join(FIXTURES_DIRECTORY, directory)
    : FIXTURES_DIRECTORY

  const routes = await readdir(nestedPath)

  for (const route of routes) {
    const basePath = path.join(directory || '/', route)
    const file = path.resolve(nestedPath, route)
    const stat = fs.statSync(file)

    // recursive directory loop
    if (stat.isDirectory()) {
      withRoutes.push(...(await createRoutes(basePath, withRoutes)))
      continue
    }

    // file found
    let method = 'get'

    let endpoint = decodeURIComponent(basePath)
    const exploded = endpoint.split('.')
    const endpointBaseName = exploded[0]

    // parse filename for method - e.g. endpoint.get.jsonld / endpoint.post.js
    if ((basePath.match(/\./g) || []).length === 2) {
      method = exploded[1]
      endpoint = endpointBaseName + '.' + exploded[2]
    }

    // if file is a script we will be running the file
    let fn = null
    if (endpoint.endsWith('.js')) {
      fn = require(file).default
      endpoint = endpoint.slice(0, -3)
    } else {
      fn = (_, res) => {
        res.sendFile(`${file}`)
      }
    }

    // create and populate the route
    const newRoute = {
      endpoint,
      method,
      fn
    }
    withRoutes.push(newRoute)

    // create alias endpoints
    if (endpoint.endsWith('.jsonld')) {
      withRoutes.push(
        Object.assign({}, newRoute, { endpoint: endpointBaseName })
      )
    }
    if (endpointBaseName.endsWith('index')) {
      withRoutes.push(
        Object.assign({}, newRoute, {
          endpoint: endpointBaseName.slice(0, -5)
        })
      )
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

  // add common hedaers
  app.use((req, res, next) => {
    res.type('application/json+ld')
    res.setHeader('access-control-allow-credentials', 'true')
    res.setHeader(
      'access-control-allow-methods',
      'GET, POST, OPTIONS, PUT, PATCH, DELETE'
    )
    res.setHeader(
      'access-control-allow-headers',
      'content-type, authorization, preload, fields, path'
    )
    res.setHeader(
      'access-control-allow-origin',
      req.get('origin') || 'http://localhost:3000'
    )
    res.setHeader(
      'link',
      '<http://localhost:' +
        process.env.API_PORT +
        '/docs.jsonld>; rel="http://www.w3.org/ns/hydra/core#apiDocumentation"'
    ) // ,<http://localhost:' + process.env.API_PORT + '/.well-known/mercure>; rel="mercure"
    next()
  })
  app.use(bodyParser.json())
  app.use(cookieParser())

  return createRoutes().then((routes) => {
    consola.log(
      'Mock endpoints...',
      routes.map((r) => `${r.endpoint} :: ${r.method}`)
    )

    for (const route in routes) {
      app[routes[route].method](routes[route].endpoint, routes[route].fn)
    }

    // fallbacks
    app.options('*', (_, res) => {
      res.status(200).send('{"message": "OK"}')
    })
    app.get('*', (_, res) => {
      res.status(404).send('{"message": "Not Found"}')
    })
    app.post('*', (_, res) => {
      res.status(404).send('{"message": "Not Found"}')
    })
    app.put('*', (_, res) => {
      res.status(404).send('{"message": "Not Found"}')
    })
    app.patch('*', (_, res) => {
      res.status(404).send('{"message": "Not Found"}')
    })
    app.delete('*', (_, res) => {
      res.status(404).send('{"message": "Not Found"}')
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
