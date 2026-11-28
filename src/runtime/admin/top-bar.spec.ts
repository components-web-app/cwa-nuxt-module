import { describe, expect, test } from 'vitest'
import { adminAreas, bottomBar, currentArea, fitTopBar, rememberSitePath, sitePath, topBarChoices, topBarItems, unknownTopBarIds } from './top-bar'
import type { CwaExtensionArea } from './extension-areas'
import type Cwa from '#cwa/cwa'

const shop: CwaExtensionArea = { segment: 'shop', label: 'Shop', icon: '<svg id="shop" />', topBar: true, pages: [{ path: '', label: 'Orders', role: 'ROLE_SHOP_ADMIN' }] }
const reports: CwaExtensionArea = { segment: 'reports', label: 'Reports', icon: '<svg id="reports" />', pages: [{ path: '', label: 'Sales', role: 'ROLE_ADMIN' }] }
const noIcon: CwaExtensionArea = { segment: 'badges', label: 'Badges', pages: [{ path: '', label: 'Badges', role: 'ROLE_ADMIN' }] }
const noPages: CwaExtensionArea = { segment: 'seo', label: 'SEO', icon: '<svg id="seo" />', pages: [] }

const everyRole = () => true
const full = { hasRole: everyRole, hasPageData: true }
const ids = (items: { id: string }[]) => items.map(item => item.id)

describe('topBarItems', () => {
  test('with no list chosen shows the built-ins in order, then the extensions that ask for the top bar, linking to their area', () => {
    const items = topBarItems([reports, shop], {}, full)
    expect(ids(items)).toEqual(['layouts', 'pages', 'data', 'routes', 'users', 'ext:shop'])
    expect(items[0]).toEqual({ id: 'layouts', label: 'Layouts', to: '/_cwa/layouts' })
    expect(items.at(-1)).toEqual({ id: 'ext:shop', label: 'Shop', to: { name: '_cwa-shop' }, icon: '<svg id="shop" />' })
  })

  test('the developer\'s list replaces the default, and the admin\'s own list replaces the developer\'s', () => {
    expect(ids(topBarItems([reports, shop], { developer: ['routes', 'ext:reports'] }, full))).toEqual(['routes', 'ext:reports'])
    expect(ids(topBarItems([reports, shop], { own: ['ext:shop', 'pages'], developer: ['routes', 'ext:reports'] }, full))).toEqual(['ext:shop', 'pages'])
  })

  test('an own list that is not a list of ids is ignored, so a stored value the module did not write never breaks the bar', () => {
    expect(ids(topBarItems([shop], { own: 'pages', developer: ['routes'] }, full))).toEqual(['routes'])
    expect(ids(topBarItems([shop], { own: ['pages', 3], developer: ['routes'] }, full))).toEqual(['routes'])
    expect(ids(topBarItems([shop], { own: null }, full))).toEqual(['layouts', 'pages', 'data', 'routes', 'users', 'ext:shop'])
  })

  test('a chosen list is the whole list, in its order, so an extension added later is not shown until switched on', () => {
    expect(ids(topBarItems([reports, shop], { own: ['ext:reports', 'pages', 'layouts'] }, full))).toEqual(['ext:reports', 'pages', 'layouts'])
  })

  test('unknown and repeated ids are left out, so an extension that was removed leaves nothing behind', () => {
    expect(ids(topBarItems([shop], { own: ['pages', 'ext:gone', 'pages', 'nonsense', 'ext:shop'] }, full))).toEqual(['pages', 'ext:shop'])
  })

  test('an empty list shows nothing, which is how everything is hidden', () => {
    expect(topBarItems([shop], { own: [] }, full)).toEqual([])
    expect(topBarItems([shop], { developer: [] }, full)).toEqual([])
  })

  test('an extension without an icon or without admin pages is never in the top bar', () => {
    expect(ids(topBarItems([noIcon, noPages], { own: ['ext:badges', 'ext:seo', 'pages'] }, full))).toEqual(['pages'])
  })

  test('the roles still decide: content areas need a content admin, Users a user admin, an extension an openable page', () => {
    const roles = ['ROLE_USER_ADMIN', 'ROLE_ADMIN']
    expect(ids(topBarItems([shop, reports], { own: ['layouts', 'users', 'ext:shop', 'ext:reports'] }, { hasRole: role => roles.includes(role), hasPageData: true }))).toEqual(['users', 'ext:reports'])
    expect(ids(topBarItems([shop], {}, { hasRole: role => role === 'ROLE_CMS_ADMIN', hasPageData: true }))).toEqual(['layouts', 'pages', 'data', 'routes'])
  })

  test('Data is left out when the API has no page data types, as the Dashboard and the menu leave it out', () => {
    expect(ids(topBarItems([], {}, { hasRole: everyRole, hasPageData: false }))).toEqual(['layouts', 'pages', 'routes', 'users'])
  })
})

describe('adminAreas', () => {
  test('lists every built-in, then every extension with admin pages, an icon or not, in a fixed order whatever the top bar shows', () => {
    const areas = adminAreas([reports, noPages, noIcon, shop], full)
    expect(ids(areas)).toEqual(['layouts', 'pages', 'data', 'routes', 'users', 'ext:reports', 'ext:badges', 'ext:shop'])
    expect(areas.find(area => area.id === 'ext:badges')).toEqual({ id: 'ext:badges', label: 'Badges', to: { name: '_cwa-badges' } })
    expect(areas.find(area => area.id === 'pages')?.description).toEqual(expect.any(String))
  })

  test('carries an extension\'s description', () => {
    expect(adminAreas([{ ...shop, description: 'Orders and products' }], full).at(-1)?.description).toBe('Orders and products')
  })

  test('only lists what the roles can open, and Data only when there are page data types', () => {
    expect(ids(adminAreas([shop, reports], { hasRole: role => role === 'ROLE_SHOP_ADMIN', hasPageData: true }))).toEqual(['ext:shop'])
    expect(ids(adminAreas([], { hasRole: role => role === 'ROLE_CMS_ADMIN', hasPageData: false }))).toEqual(['layouts', 'pages', 'routes'])
  })
})

describe('fitTopBar', () => {
  test('shows every link when they all fit, with nothing behind More', () => {
    expect(fitTopBar([40, 40, 40], 120, { active: -1, more: 30 })).toEqual({ shown: [0, 1, 2], overflow: [] })
  })

  test('when they do not all fit, keeps room for More and drops links from the end', () => {
    expect(fitTopBar([40, 40, 40, 40], 150, { active: -1, more: 30 })).toEqual({ shown: [0, 1, 2], overflow: [3] })
    expect(fitTopBar([40, 40, 40, 40], 109, { active: -1, more: 30 })).toEqual({ shown: [0], overflow: [1, 2, 3] })
  })

  test('the current area\'s link takes the last place that fits, so the bar always shows where you are', () => {
    expect(fitTopBar([40, 40, 40, 40, 40], 150, { active: 4, more: 30 })).toEqual({ shown: [0, 1, 4], overflow: [2, 3] })
    expect(fitTopBar([40, 40, 40, 40], 150, { active: 1, more: 30 })).toEqual({ shown: [0, 1, 2], overflow: [3] })
  })

  test('with no room shows nothing and puts everything behind More', () => {
    expect(fitTopBar([40, 40], 0, { active: 1, more: 30 })).toEqual({ shown: [], overflow: [0, 1] })
    expect(fitTopBar([], 0, { active: -1, more: 30 })).toEqual({ shown: [], overflow: [] })
  })
})

describe('currentArea', () => {
  const items = [{ id: 'pages', path: '/_cwa/pages' }, { id: 'ext:shop', path: '/_cwa/shop' }, { id: 'ext:shopfront', path: '/_cwa/shopfront' }]

  test('is the area whose path the route is on or under', () => {
    expect(currentArea(items, '/_cwa/pages')).toBe('pages')
    expect(currentArea(items, '/_cwa/pages/abc/routes')).toBe('pages')
    expect(currentArea(items, '/_cwa/shop/orders')).toBe('ext:shop')
  })

  test('never matches a longer segment that only starts the same, and is undefined elsewhere', () => {
    expect(currentArea(items, '/_cwa/shopfront/x')).toBe('ext:shopfront')
    expect(currentArea(items, '/_cwa/pagesx')).toBeUndefined()
    expect(currentArea(items, '/_cwa')).toBeUndefined()
  })
})

describe('bottomBar', () => {
  test('shows the first three quick links and puts the rest behind More', () => {
    expect(bottomBar(['a', 'b', 'c', 'd', 'e'])).toEqual({ shown: ['a', 'b', 'c'], more: ['d', 'e'] })
  })

  test('has nothing behind More with three links or fewer', () => {
    expect(bottomBar(['a', 'b', 'c'])).toEqual({ shown: ['a', 'b', 'c'], more: [] })
    expect(bottomBar([])).toEqual({ shown: [], more: [] })
  })
})

describe('topBarChoices', () => {
  test('lists every item that can be shown, the shown ones first in their order, whatever the editor\'s roles', () => {
    expect(topBarChoices([reports, shop, noIcon, noPages], { own: ['ext:shop', 'pages'] }).map(({ item, shown }) => [item.id, shown])).toEqual([
      ['ext:shop', true],
      ['pages', true],
      ['layouts', false],
      ['data', false],
      ['routes', false],
      ['users', false],
      ['ext:reports', false],
    ])
  })

  test('with no own list shows what the developer\'s list, else the default, shows', () => {
    const shown = (lists: Parameters<typeof topBarChoices>[1]) => topBarChoices([reports, shop], lists).filter(choice => choice.shown).map(choice => choice.item.id)
    expect(shown({})).toEqual(['layouts', 'pages', 'data', 'routes', 'users', 'ext:shop'])
    expect(shown({ developer: ['ext:reports', 'data'] })).toEqual(['ext:reports', 'data'])
  })
})

describe('unknownTopBarIds', () => {
  test('names the ids no built-in or top-bar-able extension has, so the module can warn about the developer\'s list', () => {
    expect(unknownTopBarIds(['pages', 'ext:shop', 'ext:badges', 'ext:gone', 'page'], [shop, noIcon])).toEqual(['ext:badges', 'ext:gone', 'page'])
  })
})

describe('the site page to go back to', () => {
  test('is the last site page remembered for this Cwa, else the home page', () => {
    const cwa = {} as Cwa
    const other = {} as Cwa
    expect(sitePath(cwa)).toBe('/')
    rememberSitePath(cwa, '/blog/first?tag=news#comments')
    rememberSitePath(cwa, '/about')
    expect(sitePath(cwa)).toBe('/about')
    expect(sitePath(other)).toBe('/')
  })
})
