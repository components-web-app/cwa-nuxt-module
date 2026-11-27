import { describe, expect, test } from 'vitest'
import { rememberSitePath, sitePath, topBarChoices, topBarItems, topBarSetting } from './top-bar'
import type { CwaExtensionArea } from './extension-areas'
import type Cwa from '#cwa/cwa'

const shop: CwaExtensionArea = { segment: 'shop', label: 'Shop', icon: '<svg id="shop" />', topBar: true, pages: [{ path: '', label: 'Orders', role: 'ROLE_SHOP_ADMIN' }] }
const reports: CwaExtensionArea = { segment: 'reports', label: 'Reports', icon: '<svg id="reports" />', pages: [{ path: '', label: 'Sales', role: 'ROLE_ADMIN' }] }
const noIcon: CwaExtensionArea = { segment: 'badges', label: 'Badges', pages: [{ path: '', label: 'Badges', role: 'ROLE_ADMIN' }] }
const noPages: CwaExtensionArea = { segment: 'seo', label: 'SEO', icon: '<svg id="seo" />', pages: [] }

const everyRole = () => true
const ids = (items: { id: string }[]) => items.map(item => item.id)

describe('topBarItems', () => {
  test('with nothing saved shows the built-ins in order, then the extensions that ask for the top bar, linking to their area', () => {
    const items = topBarItems([reports, shop], undefined, everyRole)
    expect(ids(items)).toEqual(['layouts', 'pages', 'data', 'routes', 'users', 'ext:shop'])
    expect(items[0]).toEqual({ id: 'layouts', label: 'Layouts', to: '/_cwa/layouts' })
    expect(items.at(-1)).toEqual({ id: 'ext:shop', label: 'Shop', to: { name: '_cwa-shop' }, icon: '<svg id="shop" />' })
  })

  test('an empty setting is the default too', () => {
    expect(ids(topBarItems([shop], '', everyRole))).toEqual(['layouts', 'pages', 'data', 'routes', 'users', 'ext:shop'])
  })

  test('a saved setting is the whole list, in its order, so an extension added later is not shown until switched on', () => {
    expect(ids(topBarItems([reports, shop], 'ext:reports,pages,layouts', everyRole))).toEqual(['ext:reports', 'pages', 'layouts'])
  })

  test('unknown and repeated ids are left out, so an extension that was removed leaves nothing behind', () => {
    expect(ids(topBarItems([shop], 'pages,ext:gone,pages,nonsense,ext:shop', everyRole))).toEqual(['pages', 'ext:shop'])
  })

  test('a setting naming nothing known shows nothing, which is how everything is hidden', () => {
    expect(topBarItems([shop], 'none', everyRole)).toEqual([])
  })

  test('an extension without an icon or without admin pages is never in the top bar', () => {
    expect(ids(topBarItems([noIcon, noPages], 'ext:badges,ext:seo,pages', everyRole))).toEqual(['pages'])
  })

  test('the roles still decide: content areas need a content admin, Users a user admin, an extension an openable page', () => {
    const roles = ['ROLE_USER_ADMIN', 'ROLE_ADMIN']
    expect(ids(topBarItems([shop, reports], 'layouts,users,ext:shop,ext:reports', role => roles.includes(role)))).toEqual(['users', 'ext:reports'])
    expect(ids(topBarItems([shop], undefined, role => role === 'ROLE_CMS_ADMIN'))).toEqual(['layouts', 'pages', 'data', 'routes'])
  })
})

describe('topBarChoices', () => {
  test('lists every item that can be shown, the shown ones first in their order, whatever the editor\'s roles', () => {
    expect(topBarChoices([reports, shop, noIcon, noPages], 'ext:shop,pages').map(({ item, shown }) => [item.id, shown])).toEqual([
      ['ext:shop', true],
      ['pages', true],
      ['layouts', false],
      ['data', false],
      ['routes', false],
      ['users', false],
      ['ext:reports', false],
    ])
  })

  test('with nothing saved shows what the default shows', () => {
    expect(topBarChoices([reports, shop], undefined).filter(choice => choice.shown).map(choice => choice.item.id)).toEqual(['layouts', 'pages', 'data', 'routes', 'users', 'ext:shop'])
  })
})

describe('topBarSetting', () => {
  test('stores the shown ids in order, and an empty list as a value that names nothing, never the empty default', () => {
    expect(topBarSetting(['ext:shop', 'pages'])).toBe('ext:shop,pages')
    expect(topBarSetting([])).toBe('none')
    expect(topBarItems([shop], topBarSetting([]), everyRole)).toEqual([])
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
