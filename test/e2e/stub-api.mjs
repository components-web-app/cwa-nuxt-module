import http from 'node:http'

const prefix = '/_api'
const routeIri = `${prefix}/_/routes//real`
const pageIri = `${prefix}/_/pages/e2e-page`
const layoutIri = `${prefix}/_/layouts/e2e-layout`

const resources = {
  [routeIri]: {
    '@id': routeIri,
    '@type': 'Route',
    'path': '/real',
    'name': 'real',
    'page': pageIri,
    '_metadata': { persisted: true },
  },
  [pageIri]: {
    '@id': pageIri,
    '@type': 'Page',
    'reference': 'e2e',
    'title': 'E2E Real Page',
    'layout': layoutIri,
    'uiComponent': 'PrimaryPageTemplate',
    'componentGroups': [],
    'isTemplate': false,
    '_metadata': { persisted: true },
  },
  [layoutIri]: {
    '@id': layoutIri,
    '@type': 'Layout',
    'reference': 'e2e',
    'uiComponent': 'CwaLayoutPrimary',
    'componentGroups': [],
    '_metadata': { persisted: true },
  },
  [`${prefix}/_/resource_manifest//real`]: {
    resource_iris: [
      { iri: routeIri, children: [{ iri: pageIri, children: [{ iri: layoutIri, children: [] }] }] },
    ],
  },
  [`${prefix}/_/site_config_parameters`]: {
    '@id': `${prefix}/_/site_config_parameters`,
    '@type': 'hydra:Collection',
    'member': [],
    'hydra:member': [],
    'totalItems': 0,
    '_metadata': { persisted: true },
  },
}

const notFound = {
  '@type': 'hydra:Error',
  'hydra:title': 'An error occurred',
  'hydra:description': 'Not Found',
  'status': 404,
}

export function startStubApi(port) {
  const server = http.createServer((req, res) => {
    const path = new URL(req.url, 'http://stub').pathname
    const body = resources[path]
    setTimeout(() => {
      res.writeHead(body ? 200 : 404, { 'content-type': 'application/ld+json' })
      res.end(JSON.stringify(body || notFound))
    }, 40 + Math.random() * 40)
  })
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', () => resolve(server))
  })
}
