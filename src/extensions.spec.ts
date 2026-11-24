import { describe, expect, test } from 'vitest'
import type { NuxtPage } from '@nuxt/schema'
import { addExtensionAdminPages, checkExtensions, extensionAdminMenu, extensionRouteRules } from './extensions'
import type { CwaExtension, ExtensionNames } from './extensions'

const noNames: ExtensionNames = { components: [], layouts: [], pages: [] }

function check(extensions: CwaExtension[], names: Record<string, Partial<ExtensionNames>> = {}, appNames: Partial<ExtensionNames> = {}) {
  return checkExtensions({
    extensions,
    namesOf: extension => ({ ...noNames, ...names[extension.name] }),
    appNames: { ...noNames, ...appNames },
    builtInAdminPaths: ['data', 'layouts', 'orphaned', 'pages', 'routes', 'settings', 'users'],
  })
}

const shop: CwaExtension = { name: '@acme/shop', prefix: 'Shop', dir: '/ext/shop' }

describe('checkExtensions', () => {
  describe('prefixes', () => {
    test('accepts a PascalCase prefix', () => {
      expect(() => check([shop])).not.toThrow()
    })

    test.each(['', 'shop', 'Shop-Ext', 'Shop Ext'])('refuses the prefix "%s", which cannot start a component name', (prefix) => {
      expect(() => check([{ ...shop, prefix }])).toThrow(`@acme/shop's prefix "${prefix}" must be PascalCase letters and digits`)
    })

    test.each(['Cwa', 'CwaShop'])('refuses the prefix "%s", because Cwa names belong to the module', (prefix) => {
      expect(() => check([{ ...shop, prefix }])).toThrow(`@acme/shop's prefix "${prefix}" must not start with Cwa`)
    })

    test('refuses a prefix another extension already uses, naming both', () => {
      expect(() => check([shop, { name: '@other/shop', prefix: 'Shop' }])).toThrow('@acme/shop and @other/shop both use the prefix "Shop"')
    })

    test('refuses an extension registered twice under one name', () => {
      expect(() => check([shop, { ...shop, prefix: 'Store' }])).toThrow('@acme/shop is registered twice')
    })
  })

  describe('names', () => {
    test('refuses a component, layout or page without the prefix, naming the file and the extension', () => {
      expect(() => check([shop], { '@acme/shop': { components: ['Price'] } }))
        .toThrow('/ext/shop/components/Price from @acme/shop must be named Shop<Name>, as ShopPrice')
      expect(() => check([shop], { '@acme/shop': { layouts: ['Basket'] } }))
        .toThrow('/ext/shop/layouts/Basket.vue from @acme/shop must be named Shop<Name>, as ShopBasket')
      expect(() => check([shop], { '@acme/shop': { pages: ['Product'] } }))
        .toThrow('/ext/shop/pages/Product.vue from @acme/shop must be named Shop<Name>, as ShopProduct')
    })

    test('refuses a name that is only the prefix', () => {
      expect(() => check([shop], { '@acme/shop': { components: ['Shop'] } }))
        .toThrow('/ext/shop/components/Shop from @acme/shop must be named Shop<Name>, as ShopShop')
    })

    test('refuses two extensions defining the same name, naming both files', () => {
      const plus: CwaExtension = { name: '@acme/shop-plus', prefix: 'ShopPlus', dir: '/ext/plus' }
      expect(() => check([shop, plus], { '@acme/shop': { components: ['ShopPlusBadge'] }, '@acme/shop-plus': { components: ['ShopPlusBadge'] } }))
        .toThrow('ShopPlusBadge is defined by both /ext/shop/components/ShopPlusBadge (@acme/shop) and /ext/plus/components/ShopPlusBadge (@acme/shop-plus)')
    })

    test('lets a layout and a component share a name, as they are different kinds', () => {
      expect(() => check([shop], { '@acme/shop': { components: ['ShopBasket'], layouts: ['ShopBasket'] } })).not.toThrow()
    })

    test('reports an app component, layout or page with an extension\'s name as an override, naming both', () => {
      const { overrides } = check([shop], { '@acme/shop': { components: ['ShopPrice'], pages: ['ShopProduct'] } }, { components: ['ShopPrice'], pages: ['ShopProduct'] })

      expect(overrides).toEqual([
        'app/cwa/components/ShopPrice replaces ShopPrice from @acme/shop',
        'app/cwa/pages/ShopProduct.vue replaces ShopProduct from @acme/shop',
      ])
    })

    test('reports no override when the app has no extension name', () => {
      expect(check([shop], { '@acme/shop': { components: ['ShopPrice'] } }, { components: ['Hero'] }).overrides).toEqual([])
    })
  })

  describe('admin pages', () => {
    const orders = { path: 'orders', file: '/ext/shop/admin/orders.vue' }

    test('accepts an admin page on a free path', () => {
      expect(() => check([{ ...shop, adminPages: [orders] }])).not.toThrow()
    })

    test('refuses an admin page on a built-in path', () => {
      expect(() => check([{ ...shop, adminPages: [{ ...orders, path: 'users' }] }]))
        .toThrow('@acme/shop\'s admin page /_cwa/users is a built-in admin page')
    })

    test('refuses an admin page whose first segment is a built-in path', () => {
      expect(() => check([{ ...shop, adminPages: [{ ...orders, path: '/settings/shop/' }] }]))
        .toThrow('@acme/shop\'s admin page /_cwa/settings/shop is a built-in admin page')
    })

    test('refuses two extensions registering the same admin path, naming both', () => {
      expect(() => check([{ ...shop, adminPages: [orders] }, { name: '@acme/store', prefix: 'Store', adminPages: [{ ...orders, path: '/orders' }] }]))
        .toThrow('/_cwa/orders is registered by both @acme/shop and @acme/store')
    })

    test.each(['ROLE_ADMIN', 'ROLE_SHOP_ACCOUNTS'])('accepts the role %s', (role) => {
      expect(() => check([{ ...shop, adminPages: [{ ...orders, role }] }])).not.toThrow()
    })

    test.each(['', 'ROLE_USER', 'SHOP_ACCOUNTS', 'role_admin'])('refuses the role "%s", which would open an admin page to any signed-in user or match no role', (role) => {
      expect(() => check([{ ...shop, adminPages: [{ ...orders, role }] }]))
        .toThrow(`@acme/shop's admin page /_cwa/orders declares the role "${role}". Use a ROLE_ name other than ROLE_USER, or leave it out for ROLE_ADMIN.`)
    })
  })
})

describe('addExtensionAdminPages', () => {
  function cwaPages(): NuxtPage[] {
    return [
      { path: '/', name: 'index', file: '/app/pages/index.vue' },
      { path: '/_cwa', file: '/layer/pages/_cwa/index.vue', children: [{ path: 'users', name: '_cwa-users', file: '/layer/pages/_cwa/index/users.vue' }] },
    ]
  }

  test('adds each admin page as a child of /_cwa, so it inherits the admin guard and sits in the admin shell', () => {
    const pages = cwaPages()

    addExtensionAdminPages(pages, [{ ...shop, adminPages: [{ path: '/orders/', file: '/ext/shop/admin/orders.vue' }] }])

    expect(pages[1]!.children).toEqual([
      { path: 'users', name: '_cwa-users', file: '/layer/pages/_cwa/index/users.vue' },
      { path: 'orders', name: '_cwa-orders', file: '/ext/shop/admin/orders.vue', meta: { cwaAdminRole: 'ROLE_ADMIN' } },
    ])
  })

  test('records a declared role in its own meta key, so the parent\'s cwa meta is not replaced', () => {
    const pages = cwaPages()

    addExtensionAdminPages(pages, [{ ...shop, adminPages: [{ path: 'shop/reports', file: '/ext/shop/admin/reports.vue', role: 'ROLE_SHOP_ACCOUNTS' }] }])

    expect(pages[1]!.children![1]).toEqual({ path: 'shop/reports', name: '_cwa-shop-reports', file: '/ext/shop/admin/reports.vue', meta: { cwaAdminRole: 'ROLE_SHOP_ACCOUNTS' } })
  })

  test('throws when the layer\'s /_cwa page is missing, since an extension page outside it would be unguarded', () => {
    expect(() => addExtensionAdminPages([{ path: '/', file: '/app/pages/index.vue' }], [{ ...shop, adminPages: [{ path: 'orders', file: '/x.vue' }] }]))
      .toThrow('@acme/shop\'s admin pages need the /_cwa page from @cwa/nuxt/layer')
  })

  test('leaves the pages alone when no extension has admin pages', () => {
    const pages = cwaPages()

    addExtensionAdminPages(pages, [shop])

    expect(pages).toEqual(cwaPages())
  })
})

describe('extensionAdminMenu', () => {
  test('lists each admin page with a menu label, in registration order, with its route name and role', () => {
    expect(extensionAdminMenu([
      { ...shop, adminPages: [{ path: 'orders', file: '/o.vue', menu: { label: 'Orders' } }, { path: 'orders/refunds', file: '/r.vue' }] },
      { name: '@acme/store', prefix: 'Store', adminPages: [{ path: 'reports', file: '/rp.vue', role: 'ROLE_SHOP_ACCOUNTS', menu: { label: 'Reports' } }] },
    ])).toEqual([
      { label: 'Orders', to: { name: '_cwa-orders' }, role: 'ROLE_ADMIN' },
      { label: 'Reports', to: { name: '_cwa-reports' }, role: 'ROLE_SHOP_ACCOUNTS' },
    ])
  })
})

describe('extensionRouteRules', () => {
  test('turns each extension\'s page cache rules into route rules, leaving any rule already set for the path to win', () => {
    const routeRules: Record<string, Record<string, unknown>> = {
      '/account/**': { cwa: { pageCache: true } },
    }

    extensionRouteRules(routeRules, [{ ...shop, pageCache: { '/basket': false, '/account/**': false } }])

    expect(routeRules).toEqual({
      '/basket': { cwa: { pageCache: false } },
      '/account/**': { cwa: { pageCache: true } },
    })
  })

  test('keeps the other route rule keys already set for the path', () => {
    const routeRules: Record<string, Record<string, unknown>> = { '/basket': { robots: false } }

    extensionRouteRules(routeRules, [{ ...shop, pageCache: { '/basket': false } }])

    expect(routeRules).toEqual({ '/basket': { robots: false, cwa: { pageCache: false } } })
  })
})
