import http from 'node:http'

const prefix = '/_api'
const routeIri = `${prefix}/_/routes//real`
const scheduledRouteIri = `${prefix}/_/routes//scheduled`
const pageIri = `${prefix}/_/pages/e2e-page`
const layoutIri = `${prefix}/_/layouts/e2e-layout`
const brokenRouteIri = `${prefix}/_/routes//broken`
const brokenRenderRouteIri = `${prefix}/_/routes//e2e-broken-render`

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
  [brokenRenderRouteIri]: {
    '@id': brokenRenderRouteIri,
    '@type': 'Route',
    'path': '/e2e-broken-render',
    'name': 'e2e-broken-render',
    'page': pageIri,
    '_metadata': { persisted: true },
  },
  [`${prefix}/_/resource_manifest//e2e-broken-render`]: {
    resource_iris: [
      { iri: brokenRenderRouteIri, children: [{ iri: pageIri, children: [{ iri: layoutIri, children: [] }] }] },
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

const scheduledResources = {
  [scheduledRouteIri]: {
    '@id': scheduledRouteIri,
    '@type': 'Route',
    'path': '/scheduled',
    'name': 'scheduled',
    'page': pageIri,
    '_metadata': { persisted: true },
  },
  [`${prefix}/_/resource_manifest//scheduled`]: {
    resource_iris: [
      { iri: scheduledRouteIri, children: [{ iri: pageIri, children: [{ iri: layoutIri, children: [] }] }] },
    ],
  },
}

let scheduledRouteIsLive = false

export function setScheduledRouteLive(isLive) {
  scheduledRouteIsLive = isLive
}

const routeCollectionIri = `${prefix}/_/routes`

let sitemapRoutePaths = ['/real']

export function setSitemapRoutePaths(paths) {
  sitemapRoutePaths = [...paths]
}

function routeCollection() {
  const member = sitemapRoutePaths.map(path => ({
    '@id': `${routeCollectionIri}/${path}`,
    '@type': 'Route',
    path,
    'page': pageIri,
    '_metadata': { persisted: true },
  }))
  return {
    '@id': routeCollectionIri,
    '@type': 'hydra:Collection',
    member,
    'hydra:member': member,
    'totalItems': member.length,
  }
}

const notFound = {
  '@type': 'hydra:Error',
  'hydra:title': 'An error occurred',
  'hydra:description': 'Not Found',
  'status': 404,
}

const serverError = {
  '@type': 'hydra:Error',
  'hydra:title': 'An error occurred',
  'hydra:description': 'Internal Server Error',
  'status': 500,
}

export function startStubApi(port) {
  const server = http.createServer((req, res) => {
    const path = new URL(req.url, 'http://stub').pathname
    const body = path === routeCollectionIri
      ? routeCollection()
      : resources[path] || (scheduledRouteIsLive ? scheduledResources[path] : undefined)
    setTimeout(() => {
      if (path === brokenRouteIri || path === `${prefix}/_/resource_manifest//broken`) {
        res.writeHead(500, { 'content-type': 'application/ld+json', 'cache-control': 'no-store, private' })
        res.end(JSON.stringify(serverError))
        return
      }
      if (!body) {
        res.writeHead(404, { 'content-type': 'application/ld+json', 'cache-control': 'no-store, private' })
        res.end(JSON.stringify(notFound))
        return
      }
      res.writeHead(200, { 'content-type': 'application/ld+json', 'cache-control': 'public, max-age=0, s-maxage=600' })
      res.end(JSON.stringify(body))
    }, 40 + Math.random() * 40)
  })
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', () => resolve(server))
  })
}
