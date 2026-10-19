import { apiPrefix } from './api-client.mjs'

export const texts = {
  source: 'Shared source component',
  pageAOther: 'Page A target component',
  pageBOther: 'Page B target component',
  third: 'Third page component',
}

export async function seedClonePages(api, token) {
  const name = key => `e2e-${token}-${key}`
  const paths = { home: `/${name('home')}`, second: `/${name('second')}`, redirect: `/${name('redirect')}`, third: `/${name('third')}` }

  const layout = await api.create('/_/layouts', { reference: name('layout'), uiComponent: 'CwaLayoutPrimary' })
  const layoutIri = layout['@id']
  const topGroup = await api.create('/_/component_groups', { reference: `top_${layoutIri}`, location: layoutIri, layouts: [layoutIri], allowedComponents: [`${apiPrefix}/component/navigation_links`] })
  const bottomGroup = await api.create('/_/component_groups', { reference: `bottom_${layoutIri}`, location: layoutIri, layouts: [layoutIri], allowedComponents: [`${apiPrefix}/component/navigation_links`] })

  const components = {}
  for (const [key, text] of Object.entries(texts)) {
    components[key] = (await api.create('/component/html_contents', { html: `<p>${text}</p>`, publishedAt: 'now' }))['@id']
  }

  const pageSpecs = [
    ['a', 'home', [['aSource', 'source'], ['aOther', 'pageAOther']]],
    ['b', 'second', [['bSource', 'source'], ['bOther', 'pageBOther']]],
    ['c', 'third', [['cThird', 'third']]],
  ]
  const groups = {}
  const positions = {}
  const routes = {}
  for (const [key, routeKey, slots] of pageSpecs) {
    const page = await api.create('/_/pages', { reference: name(`page-${key}`), title: `E2E page ${key}`, layout: layoutIri, uiComponent: 'CwaPagePrimaryPageTemplate', isTemplate: false })
    const group = await api.create('/_/component_groups', { reference: `primary_${page['@id']}`, location: page['@id'], pages: [page['@id']] })
    groups[key] = group['@id']
    for (const [positionKey, componentKey] of slots) {
      positions[positionKey] = (await api.create('/_/component_positions', { componentGroup: group['@id'], component: components[componentKey] }))['@id']
    }
    routes[routeKey] = (await api.create('/_/routes', { path: paths[routeKey], name: name(routeKey), page: page['@id'] }))['@id']
  }
  routes.redirect = (await api.create('/_/routes', { path: paths.redirect, name: name('redirect'), redirect: routes.second }))['@id']

  for (const [label, routeKey] of [['Home', 'home'], ['Second', 'second'], ['Redirect', 'redirect'], ['Third', 'third']]) {
    const link = await api.create('/component/navigation_links', { label, route: routes[routeKey], publishedAt: 'now' })
    await api.create('/_/component_positions', { componentGroup: topGroup['@id'], component: link['@id'] })
  }

  return {
    paths,
    positions,
    iris: {
      layout: layoutIri,
      topGroup: topGroup['@id'],
      bottomGroup: bottomGroup['@id'],
      source: components.source,
      pageAOther: components.pageAOther,
      pageBOther: components.pageBOther,
      third: components.third,
      pageAGroup: groups.a,
      pageBGroup: groups.b,
      pageCGroup: groups.c,
    },
  }
}
