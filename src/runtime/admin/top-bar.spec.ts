import { describe, expect, test } from 'vitest'
import { rememberSitePath, sitePath, topBarChoices, topBarItems, unknownTopBarIds } from './top-bar'
import type { CwaExtensionArea } from './extension-areas'
import type Cwa from '#cwa/cwa'

const shop: CwaExtensionArea = { segment: 'shop', label: 'Shop', icon: '<svg id="shop" />', topBar: true, pages: [{ path: '', label: 'Orders', role: 'ROLE_SHOP_ADMIN' }] }
const reports: CwaExtensionArea = { segment: 'reports', label: 'Reports', icon: '<svg id="reports" />', pages: [{ path: '', label: 'Sales', role: 'ROLE_ADMIN' }] }
const noIcon: CwaExtensionArea = { segment: 'badges', label: 'Badges', pages: [{ path: '', label: 'Badges', role: 'ROLE_ADMIN' }] }
const noPages: CwaExtensionArea = { segment: 'seo', label: 'SEO', icon: '<svg id="seo" />', pages: [] }

const everyRole = () => true
const ids = (items: { id: string }[]) => items.map(item => item.id)

describe('topBarItems', () => {
  test('with no list chosen shows the built-ins in order, then the extensions that ask for the top bar, linking to their area', () => {
    const items = topBarItems([reports, shop], {}, everyRole)
    expect(ids(items)).toEqual(['layouts', 'pages', 'data', 'routes', 'users', 'ext:shop'])
    expect(items[0]).toEqual({ id: 'layouts', label: 'Layouts', to: '/_cwa/layouts' })
    expect(items.at(-1)).toEqual({ id: 'ext:shop', label: 'Shop', to: { name: '_cwa-shop' }, icon: '<svg id="shop" />' })
  })

  test('the developer\'s list replaces the default, and the admin\'s own list replaces the developer\'s', () => {
    expect(ids(topBarItems([reports, shop], { developer: ['routes', 'ext:reports'] }, everyRole))).toEqual(['routes', 'ext:reports'])
    expect(ids(topBarItems([reports, shop], { own: ['ext:shop', 'pages'], developer: ['routes', 'ext:reports'] }, everyRole))).toEqual(['ext:shop', 'pages'])
  })

  test('an own list that is not a list of ids is ignored, so a stored value the module did not write never breaks the bar', () => {
    expect(ids(topBarItems([shop], { own: 'pages', developer: ['routes'] }, everyRole))).toEqual(['routes'])
    expect(ids(topBarItems([shop], { own: ['pages', 3], developer: ['routes'] }, everyRole))).toEqual(['routes'])
    expect(ids(topBarItems([shop], { own: null }, everyRole))).toEqual(['layouts', 'pages', 'data', 'routes', 'users', 'ext:shop'])
  })

  test('a chosen list is the whole list, in its order, so an extension added later is not shown until switched on', () => {
    expect(ids(topBarItems([reports, shop], { own: ['ext:reports', 'pages', 'layouts'] }, everyRole))).toEqual(['ext:reports', 'pages', 'layouts'])
  })

  test('unknown and repeated ids are left out, so an extension that was removed leaves nothing behind', () => {
    expect(ids(topBarItems([shop], { own: ['pages', 'ext:gone', 'pages', 'nonsense', 'ext:shop'] }, everyRole))).toEqual(['pages', 'ext:shop'])
  })

  test('an empty list shows nothing, which is how everything is hidden', () => {
    expect(topBarItems([shop], { own: [] }, everyRole)).toEqual([])
    expect(topBarItems([shop], { developer: [] }, everyRole)).toEqual([])
  })

  test('an extension without an icon or without admin pages is never in the top bar', () => {
    expect(ids(topBarItems([noIcon, noPages], { own: ['ext:badges', 'ext:seo', 'pages'] }, everyRole))).toEqual(['pages'])
  })

  test('the roles still decide: content areas need a content admin, Users a user admin, an extension an openable page', () => {
    const roles = ['ROLE_USER_ADMIN', 'ROLE_ADMIN']
    expect(ids(topBarItems([shop, reports], { own: ['layouts', 'users', 'ext:shop', 'ext:reports'] }, role => roles.includes(role)))).toEqual(['users', 'ext:reports'])
    expect(ids(topBarItems([shop], {}, role => role === 'ROLE_CMS_ADMIN'))).toEqual(['layouts', 'pages', 'data', 'routes'])
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
