import util from 'util'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import express from 'express'
import bodyParser from 'body-parser'
import consola from 'consola'
import cookieParser from 'cookie-parser'
import session from 'express-session'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const FIXTURES_DIRECTORY = path.resolve(__dirname, '..', `fixtures`)
const readdir = util.promisify(fs.readdir)

/**
 * Creates a mocked API via the files given in `fixtures`
 * For now it reads the `_` and `component` directories
 * and declares routes matching file names
 */

export class ApiServer {
  constructor() {
    this.app = express()
    this.initMiddleware()
  }

  async create() {
    const routes = await this.createRoutes()

    consola.log(
      'Mock endpoints...',
      routes.map((r) => `${r.endpoint} :: ${r.method}`)
    )

    for (const route in routes) {
      this.app[routes[route].method](routes[route].endpoint, routes[route].fn)
    }

    this.createFallbackRoutes()

    return this.app
  }

  initMiddleware() {
    this.app.use((req, res, next) => {
      res.setHeader('accept-ranges', 'bytes')
      res.setHeader('access-control-allow-credentials', 'true')
      res.setHeader(
        'access-control-allow-headers',
        'content-type, authorization, preload, fields, path'
      )
      res.setHeader(
        'access-control-allow-methods',
        'GET, OPTIONS, POST, PUT, PATCH, DELETE'
      )
      res.setHeader(
        'access-control-allow-origin',
        req.get('origin') || 'http://localhost:3000'
      )
      res.setHeader('access-control-max-age', 3600)
      res.setHeader('cache-control', 'no-cache, private')
      res.setHeader('age', 0)
      res.setHeader('vary', 'Origin')

      if (req.method === 'OPTIONS') {
        res.type('text/html; charset=UTF-8')
        next()
        return
      }

      res.type('application/json+ld')
      res.setHeader('access-control-expose-headers', 'link')
      res.setHeader(
        'link',
        '<http://localhost:' +
          process.env.API_PORT +
          '/docs.jsonld>; rel="http://www.w3.org/ns/hydra/core#apiDocumentation"'
      ) // ,<http://localhost:' + process.env.API_PORT + '/.well-known/mercure>; rel="mercure"
      next()
    })
    this.app.use(
      bodyParser.json({
        type: ['application/merge-patch+json', 'application/json']
      })
    )
    this.app.use(cookieParser())
    this.app.use(
      session({
        secret: 'dev no secret',
        resave: true,
        saveUninitialized: true
      })
    )
  }

  async createRoutes(directory = null) {
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
        withRoutes.push(...(await this.createRoutes(basePath)))
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
      if (endpoint.endsWith('.js') || endpoint.endsWith('.cjs')) {
        const imported = await import(file)
        fn = imported.default
        const parts = endpoint.split('.')
        parts.pop()
        endpoint = parts.join('.')
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

  createFallbackRoutes() {
    // fallbacks
    this.app.options('*', (_, res) => {
      res.status(200).send('{"message": "OK"}')
    })
    this.app.get('*', (_, res) => {
      res.status(404).send('{"message": "Not Found"}')
    })
    this.app.post('*', (_, res) => {
      res.status(404).send('{"message": "Not Found"}')
    })
    this.app.put('*', (_, res) => {
      res.status(404).send('{"message": "Not Found"}')
    })
    this.app.patch('*', (_, res) => {
      res.status(404).send('{"message": "Not Found"}')
    })
    this.app.delete('*', (_, res) => {
      res.status(404).send('{"message": "Not Found"}')
    })
  }
}

export default ApiServer
