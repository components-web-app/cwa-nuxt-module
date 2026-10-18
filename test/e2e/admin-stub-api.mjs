import http from 'node:http'
import { randomUUID } from 'node:crypto'

const prefix = '/_api'
const layoutIri = `${prefix}/_/layouts/e2e-layout`
const htmlEndpoint = `${prefix}/component/html_contents`
const navEndpoint = `${prefix}/component/navigation_links`
const positionEndpoint = `${prefix}/_/component_positions`
const groupEndpoint = `${prefix}/_/component_groups`

export const iris = {
  layout: layoutIri,
  topGroup: `${groupEndpoint}/top`,
  source: `${htmlEndpoint}/source`,
  pageAOther: `${htmlEndpoint}/page-a-other`,
  pageBOther: `${htmlEndpoint}/page-b-other`,
  third: `${htmlEndpoint}/third`,
  pageAGroup: `${groupEndpoint}/page-a`,
  pageBGroup: `${groupEndpoint}/page-b`,
  pageCGroup: `${groupEndpoint}/page-c`,
}

export const texts = {
  source: 'Shared source component',
  pageAOther: 'Page A target component',
  pageBOther: 'Page B target component',
  third: 'Third page component',
}

function meta() {
  return { persisted: true }
}

function buildResources() {
  const resources = new Map()
  const put = resource => resources.set(resource['@id'], resource)

  const navLinks = [
    ['home', 'Home', '/'],
    ['second', 'Second', '/second'],
    ['redirect', 'Redirect', '/redirect'],
    ['third', 'Third', '/third'],
  ]
  const navPositions = navLinks.map(([key, label, url], index) => {
    const linkIri = `${navEndpoint}/${key}`
    put({ '@id': linkIri, '@type': 'NavigationLink', label, url, 'componentPositions': [`${positionEndpoint}/nav-${key}`], '_metadata': meta() })
    put({ '@id': `${positionEndpoint}/nav-${key}`, '@type': 'ComponentPosition', 'componentGroup': iris.topGroup, 'component': linkIri, 'sortValue': index, '_metadata': meta() })
    return `${positionEndpoint}/nav-${key}`
  })
  put({
    '@id': iris.topGroup,
    '@type': 'ComponentGroup',
    'reference': `top_${layoutIri}`,
    'location': layoutIri,
    'layouts': [layoutIri],
    'pages': [],
    'components': [],
    'componentPositions': navPositions,
    'allowedComponents': [navEndpoint],
    '_metadata': meta(),
  })
  put({
    '@id': `${groupEndpoint}/bottom`,
    '@type': 'ComponentGroup',
    'reference': `bottom_${layoutIri}`,
    'location': layoutIri,
    'layouts': [layoutIri],
    'pages': [],
    'components': [],
    'componentPositions': [],
    'allowedComponents': [navEndpoint],
    '_metadata': meta(),
  })
  put({
    '@id': layoutIri,
    '@type': 'Layout',
    'reference': 'e2e',
    'uiComponent': 'CwaLayoutPrimary',
    'componentGroups': [iris.topGroup, `${groupEndpoint}/bottom`],
    '_metadata': meta(),
  })

  const pages = [
    ['page-a', '/', 'home', [['a-source', iris.source], ['a-other', iris.pageAOther]]],
    ['page-b', '/second', 'second', [['b-source', iris.source], ['b-other', iris.pageBOther]]],
    ['page-c', '/third', 'third', [['c-third', iris.third]]],
  ]
  for (const [key, path, name, positions] of pages) {
    const pageIri = `${prefix}/_/pages/${key}`
    const groupIri = `${groupEndpoint}/${key}`
    const positionIris = positions.map(([positionKey, componentIri], index) => {
      const positionIri = `${positionEndpoint}/${positionKey}`
      put({ '@id': positionIri, '@type': 'ComponentPosition', 'componentGroup': groupIri, 'component': componentIri, 'sortValue': index, '_metadata': meta() })
      return positionIri
    })
    put({
      '@id': groupIri,
      '@type': 'ComponentGroup',
      'reference': `primary_${pageIri}`,
      'location': pageIri,
      'layouts': [],
      'pages': [pageIri],
      'components': [],
      'componentPositions': positionIris,
      '_metadata': meta(),
    })
    put({
      '@id': pageIri,
      '@type': 'Page',
      'reference': key,
      'title': `E2E ${key}`,
      'layout': layoutIri,
      'uiComponent': 'CwaPagePrimaryPageTemplate',
      'componentGroups': [groupIri],
      'isTemplate': false,
      '_metadata': meta(),
    })
    put({ '@id': `${prefix}/_/routes/${path}`, '@type': 'Route', path, name, 'page': pageIri, '_metadata': meta() })
  }
  put({ '@id': `${prefix}/_/routes//redirect`, '@type': 'Route', 'path': '/redirect', 'name': 'redirect', 'redirect': `${prefix}/_/routes//second`, 'redirectPath': '/second', '_metadata': meta() })

  const htmlTexts = { [iris.source]: texts.source, [iris.pageAOther]: texts.pageAOther, [iris.pageBOther]: texts.pageBOther, [iris.third]: texts.third }
  for (const [iri, text] of Object.entries(htmlTexts)) {
    put({ '@id': iri, '@type': 'HtmlContent', 'html': `<p>${text}</p>`, 'componentPositions': [], '_metadata': meta() })
  }
  syncComponentPositions(resources)
  return resources
}

function syncComponentPositions(resources) {
  for (const resource of resources.values()) {
    if (resource['@type'] === 'HtmlContent' || resource['@type'] === 'NavigationLink') {
      resource.componentPositions = []
    }
  }
  for (const resource of resources.values()) {
    if (resource['@type'] === 'ComponentPosition' && resource.component) {
      resources.get(resource.component)?.componentPositions.push(resource['@id'])
    }
  }
}

function manifestFor(resources, path) {
  const route = resources.get(`${prefix}/_/routes/${path}`)
  if (!route) {
    return
  }
  const targetRoute = route.redirectPath ? resources.get(`${prefix}/_/routes/${route.redirectPath}`) : route
  const page = resources.get(targetRoute.page)
  return {
    resource_iris: [
      { iri: route['@id'], children: [{ iri: page['@id'], children: [{ iri: layoutIri, children: [] }] }] },
    ],
  }
}

const entrypoint = {
  '@id': `${prefix}/`,
  '@type': 'Entrypoint',
  'htmlContent': htmlEndpoint,
  'navigationLink': navEndpoint,
  'componentPosition': positionEndpoint,
  'componentGroup': groupEndpoint,
}

const docs = {
  '@id': `${prefix}/docs.jsonld`,
  'supportedClass': [
    { title: 'HtmlContent', supportedProperty: [{ title: 'html' }] },
    { title: 'NavigationLink', supportedProperty: [{ title: 'label' }, { title: 'url' }] },
    { title: 'ComponentPosition', supportedProperty: [{ title: 'component' }] },
  ],
}

const collection = id => ({ '@id': id, '@type': 'hydra:Collection', 'member': [], 'hydra:member': [], 'totalItems': 0 })

const adminUser = {
  '@id': `${prefix}/users/admin`,
  '@type': 'User',
  'username': 'admin',
  'emailAddress': 'admin@example.com',
  'roles': ['ROLE_ADMIN', 'ROLE_USER'],
  'enabled': true,
  'emailAddressVerified': true,
  '_metadata': meta(),
}

function orderOf(resources, groupIri) {
  const group = resources.get(groupIri)
  return {
    '@id': `${groupIri}/order`,
    'sortValues': Object.fromEntries(group.componentPositions.map(iri => [iri, resources.get(iri).sortValue])),
  }
}

function renumber(resources, group) {
  group.componentPositions.forEach((iri, index) => {
    resources.get(iri).sortValue = index
  })
}

export function startAdminStubApi(port) {
  const state = { resources: buildResources(), writes: [] }
  const origin = `http://127.0.0.1:${port}`

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://stub')
    const path = url.pathname
    const headers = {
      'content-type': 'application/ld+json',
      'cache-control': 'no-store, private',
      'access-control-allow-origin': req.headers.origin || '*',
      'access-control-allow-credentials': 'true',
      'access-control-allow-headers': 'content-type, accept, path, preload',
      'access-control-allow-methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
      'access-control-expose-headers': 'link',
    }
    const send = (status, body, extra = {}) => {
      res.writeHead(status, { ...headers, ...extra })
      res.end(body === undefined ? '' : JSON.stringify(body))
    }
    if (req.method === 'OPTIONS') {
      send(204)
      return
    }
    let raw = ''
    req.on('data', (chunk) => {
      raw += chunk
    })
    req.on('end', () => {
      const body = raw ? JSON.parse(raw) : undefined
      if (req.method !== 'GET') {
        state.writes.push({ method: req.method, path: `${path}${url.search}`, body })
      }
      const { resources } = state

      if (path === `${prefix}/me`) {
        send(200, adminUser, { link: `<${origin}${prefix}/docs.jsonld>; rel="http://www.w3.org/ns/hydra/core#apiDocumentation"` })
        return
      }
      if (path === `${prefix}/login` || path === `${prefix}/logout`) {
        send(200, {})
        return
      }
      if (path === prefix || path === `${prefix}/`) {
        send(200, entrypoint)
        return
      }
      if (path === `${prefix}/docs.jsonld`) {
        send(200, docs)
        return
      }
      if (path === `${prefix}/_/page_data_metadatas` || path === `${prefix}/_/site_config_parameters`) {
        send(200, collection(path))
        return
      }
      if (path.startsWith(`${prefix}/_/resource_manifest/`)) {
        const manifest = manifestFor(resources, path.slice(`${prefix}/_/resource_manifest/`.length))
        manifest ? send(200, manifest) : send(404, { status: 404 })
        return
      }
      if (path.endsWith('/usage')) {
        const iri = path.slice(0, -'/usage'.length)
        const positionCount = [...resources.values()].filter(r => r['@type'] === 'ComponentPosition' && r.component === iri).length
        send(200, { positionCount, pageDataCount: 0, total: positionCount })
        return
      }
      if (path.endsWith('/order')) {
        const groupIri = path.slice(0, -'/order'.length)
        if (!resources.has(groupIri)) {
          send(404, { status: 404 })
          return
        }
        send(200, orderOf(resources, groupIri))
        return
      }
      if (req.method === 'POST' && path === positionEndpoint) {
        const group = resources.get(body.componentGroup)
        if (!group || !resources.has(body.component)) {
          send(422, { violations: [{ propertyPath: 'component', message: 'Invalid' }] })
          return
        }
        const iri = `${positionEndpoint}/${randomUUID()}`
        const position = { '@id': iri, '@type': 'ComponentPosition', 'componentGroup': group['@id'], 'component': body.component, 'sortValue': 0, '_metadata': meta() }
        resources.set(iri, position)
        const anchorIndex = body.after ? group.componentPositions.indexOf(body.after) + 1 : body.before ? group.componentPositions.indexOf(body.before) : group.componentPositions.length
        group.componentPositions.splice(anchorIndex, 0, iri)
        renumber(resources, group)
        syncComponentPositions(resources)
        send(201, position)
        return
      }
      if (req.method === 'DELETE') {
        const resource = resources.get(path)
        if (!resource) {
          send(404, { status: 404 })
          return
        }
        resources.delete(path)
        if (resource['@type'] === 'ComponentPosition') {
          const group = resources.get(resource.componentGroup)
          group.componentPositions = group.componentPositions.filter(iri => iri !== path)
          renumber(resources, group)
        }
        syncComponentPositions(resources)
        send(204)
        return
      }
      if (req.method === 'PATCH') {
        const resource = resources.get(path)
        if (!resource) {
          send(404, { status: 404 })
          return
        }
        Object.assign(resource, body)
        send(200, resource)
        return
      }
      const resource = resources.get(path)
      if (!resource) {
        send(404, { '@type': 'hydra:Error', 'status': 404 })
        return
      }
      send(200, resource)
    })
  })

  const groupByReference = (reference) => {
    for (const resource of state.resources.values()) {
      if (resource['@type'] === 'ComponentGroup' && resource.reference === reference) {
        return resource
      }
    }
  }
  const originalEmit = server.emit.bind(server)
  server.emit = (event, req, res) => {
    if (event === 'request' && req.method === 'GET') {
      const path = new URL(req.url, 'http://stub').pathname
      const refPrefix = `${groupEndpoint}/`
      if (path.startsWith(refPrefix) && !state.resources.has(path)) {
        const group = groupByReference(decodeURIComponent(path.slice(refPrefix.length)))
        if (group) {
          req.url = group['@id']
        }
      }
    }
    return originalEmit(event, req, res)
  }

  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', () => resolve({
      server,
      state,
      reset() {
        state.resources = buildResources()
        state.writes.length = 0
      },
    }))
  })
}
