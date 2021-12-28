const util = require('util')
const fs = require('fs')
const path = require('path')
const express = require('express')
const bodyParser = require('body-parser')
const consola = require('consola')
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
    if (stat.isDirectory()) {
      withRoutes.push(...(await createRoutes(basePath, withRoutes)))
    } else {
      // file that should be an endpoint
      let method = 'get'

      let endpoint = decodeURIComponent(basePath)
      const exploded = endpoint.split('.')
      const endpointBaseName = exploded[0]

      if ((basePath.match(/\./g) || []).length === 2) {
        method = exploded[1]
        endpoint = endpointBaseName + '.' + exploded[2]
      }

      let fn = (_, res) => {
        res.sendFile(`${file}`, { root: null })
      }

      if (endpoint.endsWith('.js')) {
        fn = require(file).default
        endpoint = endpoint.slice(0, -3)
      }

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
  app.use(bodyParser.json())

  return createRoutes().then((routes) => {
    consola.log(
      'Mock endpoints...',
      routes.map((r) => `${r.endpoint} :: ${r.method}`)
    )

    app.all('*', (req, res, next) => {
      res.type('application/json+ld')
      res.setHeader('Access-Control-Allow-Credentials', 'true')
      res.setHeader(
        'Access-Control-Allow-Methods',
        'GET, POST, OPTIONS, PUT, PATCH, DELETE'
      )
      res.setHeader(
        'Access-Control-Allow-Headers',
        'content-type, authorization, preload, fields, path'
      )
      res.setHeader(
        'Access-Control-Allow-Origin',
        req.get('origin') || 'http://localhost:3000'
      )
      res.setHeader(
        'Link',
        '<http://localhost:' +
          process.env.API_PORT +
          '/docs.jsonld>; rel="http://www.w3.org/ns/hydra/core#apiDocumentation"'
      ) // ,<http://localhost:' + process.env.API_PORT + '/.well-known/mercure>; rel="mercure"
      next()
    })

    for (const route in routes) {
      app[routes[route].method](routes[route].endpoint, routes[route].fn)
    }

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
