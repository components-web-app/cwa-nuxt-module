import { describe, expect, test } from 'vitest'
import type { NuxtPage } from '@nuxt/schema'
import { addExtensionAdminPages, adminShellRoles, checkExtensions, extensionAdminRoles, extensionAreas, extensionPageDataTemplate, extensionPageRoles, extensionRouteRules, extensionSegment } from './extensions'
import type { CwaExtension, ExtensionNames } from './extensions'

const noNames: ExtensionNames = { components: [], layouts: [], pages: [] }

function check(extensions: CwaExtension[], names: Record<string, Partial<ExtensionNames>> = {}, appNames: Partial<ExtensionNames> = {}) {
  return checkExtensions({
    extensions,
    namesOf: extension => ({ ...noNames, ...names[extension.name] }),
    appNames: { ...noNames, ...appNames },
    builtInAdminPaths: ['data', 'extensions', 'layouts', 'orphaned', 'pages', 'routes', 'settings', 'users'],
  })
}

const shop: CwaExtension = { name: '@acme/shop', prefix: 'Shop', label: 'Shop', dir: '/ext/shop' }

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
      expect(() => check([shop, { name: '@other/shop', prefix: 'Shop', label: 'Other shop' }])).toThrow('@acme/shop and @other/shop both use the prefix "Shop"')
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
      const plus: CwaExtension = { name: '@acme/shop-plus', prefix: 'ShopPlus', label: 'Shop plus', dir: '/ext/plus' }
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
    const orders = { path: 'orders', label: 'Orders', file: '/ext/shop/admin/orders.vue' }

    test('accepts an admin page with a label', () => {
      expect(() => check([{ ...shop, adminPages: [orders] }])).not.toThrow()
    })

    test('refuses an admin page without a label, which its tab needs', () => {
      expect(() => check([{ ...shop, adminPages: [{ path: 'orders', file: '/o.vue' } as never] }]))
        .toThrow('@acme/shop\'s admin page /_cwa/shop/orders needs a label for its tab')
      expect(() => check([{ ...shop, adminPages: [{ ...orders, label: ' ' }] }]))
        .toThrow('@acme/shop\'s admin page /_cwa/shop/orders needs a label for its tab')
    })

    test.each(['extensions', 'pages', 'users'])('refuses an area whose segment is the built-in admin path %s', (segment) => {
      const prefix = segment.charAt(0).toUpperCase() + segment.slice(1)
      expect(() => check([{ ...shop, prefix, adminPages: [orders] }]))
        .toThrow(`@acme/shop's admin area /_cwa/${segment}, from its prefix "${prefix}", is a built-in admin page`)
    })

    test('lets an extension without admin pages use a prefix that would be a built-in path, as it has no area', () => {
      expect(() => check([{ ...shop, prefix: 'Pages' }])).not.toThrow()
    })

    test('refuses two extensions whose prefixes give the same area segment, naming both', () => {
      expect(() => check([{ ...shop, prefix: 'AbShop', adminPages: [orders] }, { name: '@acme/store', prefix: 'ABShop', label: 'Store', adminPages: [orders] }]))
        .toThrow('@acme/shop and @acme/store both have the admin area /_cwa/ab-shop, from their prefixes "AbShop" and "ABShop"')
    })

    test('refuses an admin page whose route would be another extension\'s area', () => {
      expect(() => check([{ ...shop, adminPages: [{ ...orders, path: 'plus' }] }, { name: '@acme/shop-plus', prefix: 'ShopPlus', label: 'Shop plus', adminPages: [orders] }]))
        .toThrow('/_cwa/shop/plus and /_cwa/shop-plus (@acme/shop-plus) would both be the route _cwa-shop-plus')
    })

    test('refuses one extension registering the same admin page twice', () => {
      expect(() => check([{ ...shop, adminPages: [orders, { ...orders, path: '/orders/' }] }]))
        .toThrow('/_cwa/shop/orders and /_cwa/shop/orders (@acme/shop) would both be the route _cwa-shop-orders')
    })

    test.each(['ROLE_ADMIN', 'ROLE_SHOP_ACCOUNTS'])('accepts the role %s', (role) => {
      expect(() => check([{ ...shop, adminPages: [{ ...orders, role }] }])).not.toThrow()
    })

    test.each(['', 'ROLE_USER', 'SHOP_ACCOUNTS', 'role_admin'])('refuses the role "%s", which would open an admin page to any signed-in user or match no role', (role) => {
      expect(() => check([{ ...shop, adminPages: [{ ...orders, role }] }]))
        .toThrow(`@acme/shop's admin page /_cwa/shop/orders declares the role "${role}". Use a ROLE_ name other than ROLE_USER, or leave it out for ROLE_ADMIN.`)
    })
  })

  describe('page-data tabs and lists', () => {
    const formats = { key: 'formats', label: 'Formats and prices', file: '/ext/shop/admin/formats.vue', forTypesWithProperty: 'variants' }
    const products = { path: 'products', label: 'Products', forTypesWithProperty: 'variants' }

    test('accepts a page-data tab and a page-data list', () => {
      expect(() => check([{ ...shop, pageDataTabs: [formats], pageDataLists: [products] }])).not.toThrow()
    })

    test.each([['details', 'Details'], ['routes', 'Routes'], ['info', 'Info']])('refuses a page-data tab with the key of the built-in %s tab', (key, label) => {
      expect(() => check([{ ...shop, pageDataTabs: [{ ...formats, key }] }]))
        .toThrow(`@acme/shop's page-data tab "${key}" has the key of the built-in ${label} tab`)
    })

    test('refuses a page-data tab key another extension already uses, naming both, and one extension using a key twice', () => {
      expect(() => check([{ ...shop, pageDataTabs: [formats] }, { name: '@acme/store', prefix: 'Store', label: 'Store', pageDataTabs: [formats] }]))
        .toThrow('@acme/shop and @acme/store both have the page-data tab "formats"')
      expect(() => check([{ ...shop, pageDataTabs: [formats, formats] }]))
        .toThrow('@acme/shop has the page-data tab "formats" twice')
    })

    test.each([undefined, '', ' '])('refuses a page-data tab or list whose forTypesWithProperty is %j, as it would show for no type or every type', (forTypesWithProperty) => {
      expect(() => check([{ ...shop, pageDataTabs: [{ ...formats, forTypesWithProperty } as never] }]))
        .toThrow('@acme/shop\'s page-data tab "formats" needs forTypesWithProperty, the API property a page data type must have to show it')
      expect(() => check([{ ...shop, pageDataLists: [{ ...products, forTypesWithProperty } as never] }]))
        .toThrow('@acme/shop\'s page-data list /_cwa/shop/products needs forTypesWithProperty, the API property a page data type must have to be listed')
    })

    test('refuses a page-data list whose path is one of the extension\'s own admin pages', () => {
      expect(() => check([{ ...shop, adminPages: [{ path: 'products', label: 'Catalogue', file: '/p.vue' }], pageDataLists: [{ ...products, path: '/products/' }] }]))
        .toThrow('@acme/shop\'s page-data list /_cwa/shop/products has the path of its own admin page /_cwa/shop/products')
    })

    test('refuses a page-data tab with a role that is not an admin role', () => {
      expect(() => check([{ ...shop, pageDataTabs: [{ ...formats, role: 'ROLE_USER' }] }]))
        .toThrow('@acme/shop\'s page-data tab "formats" declares the role "ROLE_USER". Use a ROLE_ name other than ROLE_USER, or leave it out for ROLE_ADMIN.')
    })
  })
})

describe('extensionSegment', () => {
  test.each([['Ecommerce', 'ecommerce'], ['SilverbackShop', 'silverback-shop'], ['ABShop', 'ab-shop'], ['Shop2Go', 'shop2-go']])('%s is the area /_cwa/%s', (prefix, segment) => {
    expect(extensionSegment(prefix)).toBe(segment)
  })
})

const listFiles = { list: '/cwa/extension-page-data-list.vue', item: '/cwa/extension-page-data-item.vue' }

describe('addExtensionAdminPages', () => {
  const ecommerce: CwaExtension = { name: '@acme/ecommerce', prefix: 'Ecommerce', label: 'E-commerce' }

  function cwaPages(): NuxtPage[] {
    return [
      { path: '/', name: 'index', file: '/app/pages/index.vue' },
      { path: '/_cwa', file: '/layer/pages/_cwa/index.vue', children: [
        { path: 'users', name: '_cwa-users', file: '/layer/pages/_cwa/index/users.vue' },
        { path: 'extensions', name: '_cwa-index-extensions', file: '/layer/pages/_cwa/index/extensions.vue' },
      ] },
    ]
  }

  test('puts each extension\'s pages in its area, a child of /_cwa named from its prefix, so they inherit the admin guard and an item page becomes a keyed :iri child', () => {
    const pages = cwaPages()

    addExtensionAdminPages(pages, [{ ...ecommerce, adminPages: [
      { path: '/orders/', label: 'Orders', file: '/ext/admin/orders.vue', item: '/ext/admin/order.vue' },
      { path: 'reports', label: 'Reports', file: '/ext/admin/reports.vue', role: 'ROLE_SHOP_ACCOUNTS' },
    ] }], '/cwa/extension-area.vue', listFiles)

    expect(pages[1]!.children![2]).toEqual({
      path: 'ecommerce',
      name: '_cwa-ecommerce',
      file: '/cwa/extension-area.vue',
      meta: { cwaAdminRole: ['ROLE_ADMIN', 'ROLE_SHOP_ACCOUNTS'], middleware: ['cwa-extension-area'], pageTransition: false },
      children: [
        {
          path: 'orders',
          name: '_cwa-ecommerce-orders',
          file: '/ext/admin/orders.vue',
          meta: { cwaAdminRole: 'ROLE_ADMIN' },
          children: [{ path: ':iri', name: '_cwa-ecommerce-orders-iri', file: '/ext/admin/order.vue', meta: { cwaAdminRole: 'ROLE_ADMIN', key: '_cwa-ecommerce-orders-iri' } }],
        },
        { path: 'reports', name: '_cwa-ecommerce-reports', file: '/ext/admin/reports.vue', meta: { cwaAdminRole: 'ROLE_SHOP_ACCOUNTS' } },
      ],
    })
  })

  test('makes each page-data list a tab of the area after its admin pages, with the module\'s list page and the page-data dialog as its keyed :iri child', () => {
    const pages = cwaPages()

    addExtensionAdminPages(pages, [{ ...ecommerce, adminPages: [{ path: 'orders', label: 'Orders', file: '/ext/admin/orders.vue' }], pageDataLists: [
      { path: 'products', label: 'Products', forTypesWithProperty: 'variants', role: 'ROLE_SHOP_PRODUCTS' },
    ] }], '/cwa/extension-area.vue', listFiles)

    expect(pages[1]!.children![2]!.meta!.cwaAdminRole).toEqual(['ROLE_ADMIN', 'ROLE_SHOP_PRODUCTS'])
    expect(pages[1]!.children![2]!.children).toEqual([
      { path: 'orders', name: '_cwa-ecommerce-orders', file: '/ext/admin/orders.vue', meta: { cwaAdminRole: 'ROLE_ADMIN' } },
      {
        path: 'products',
        name: '_cwa-ecommerce-products',
        file: listFiles.list,
        meta: { cwaAdminRole: 'ROLE_SHOP_PRODUCTS' },
        children: [{ path: ':iri', name: '_cwa-ecommerce-products-iri', file: listFiles.item, meta: { cwaAdminRole: 'ROLE_SHOP_PRODUCTS', key: '_cwa-ecommerce-products-iri' } }],
      },
    ])
  })

  test('opens the Extensions page to admins and to every role an extension page needs', () => {
    const pages = cwaPages()

    addExtensionAdminPages(pages, [{ ...ecommerce, adminPages: [{ path: 'reports', label: 'Reports', file: '/r.vue', role: 'ROLE_SHOP_ACCOUNTS' }] }], '/area.vue', listFiles)

    expect(pages[1]!.children![1]!.meta).toEqual({ cwaAdminRole: ['ROLE_ADMIN', 'ROLE_SHOP_ACCOUNTS'] })
  })

  test('opens My account to exactly the roles that get the admin header: content and user admins and every role an extension page needs (#508)', () => {
    const pages = cwaPages()
    pages[1]!.children!.push({ path: 'account', name: '_cwa-account', file: '/layer/pages/_cwa/index/account.vue' })
    const extensions = [{ ...ecommerce, adminPages: [{ path: 'reports', label: 'Reports', file: '/r.vue', role: 'ROLE_SHOP_ACCOUNTS' }] }]

    addExtensionAdminPages(pages, extensions, '/area.vue', listFiles)

    expect(adminShellRoles(extensions)).toEqual(['ROLE_CMS_ADMIN', 'ROLE_USER_ADMIN', 'ROLE_SHOP_ACCOUNTS'])
    expect(pages[1]!.children!.find(page => page.name === '_cwa-account')!.meta).toEqual({ cwaAdminRole: adminShellRoles(extensions) })
  })

  test('opens My account to content and user admins when no extension has admin pages (#508)', () => {
    const pages = cwaPages()
    pages[1]!.children!.push({ path: 'account', name: '_cwa-account', file: '/layer/pages/_cwa/index/account.vue' })

    addExtensionAdminPages(pages, [shop], '/area.vue', listFiles)

    expect(pages[1]!.children!.find(page => page.name === '_cwa-account')!.meta).toEqual({ cwaAdminRole: ['ROLE_CMS_ADMIN', 'ROLE_USER_ADMIN'] })
  })

  test('throws when the layer\'s /_cwa page is missing, since an extension page outside it would be unguarded', () => {
    expect(() => addExtensionAdminPages([{ path: '/', file: '/app/pages/index.vue' }], [{ ...shop, adminPages: [{ path: 'orders', label: 'Orders', file: '/x.vue' }] }], '/area.vue', listFiles))
      .toThrow('@acme/shop\'s admin pages need the /_cwa page from @cwa/nuxt/layer')
  })

  test('adds no area when no extension has admin pages', () => {
    const pages = cwaPages()

    addExtensionAdminPages(pages, [shop], '/area.vue', listFiles)

    expect(pages[1]!.children!.map(page => page.name)).toEqual(['_cwa-users', '_cwa-index-extensions'])
  })
})

describe('extensionAreas', () => {
  test('lists every extension with its label, description, icon and pages in declared order with their roles, and one without pages too', () => {
    expect(extensionAreas([
      { name: '@acme/ecommerce', prefix: 'Ecommerce', label: 'E-commerce', description: 'Orders, products and payments', icon: 'lucide:shopping-cart', adminPages: [
        { path: 'orders', label: 'Orders', file: '/o.vue' },
        { path: 'products', label: 'Products', file: '/p.vue', role: 'ROLE_SHOP_PRODUCTS' },
      ] },
      { name: '@acme/badges', prefix: 'Badges', label: 'Badges', icon: 'lucide:not-an-icon' },
    ], icon => icon === 'lucide:shopping-cart' ? '<svg />' : undefined)).toEqual([
      { segment: 'ecommerce', label: 'E-commerce', description: 'Orders, products and payments', icon: '<svg />', pages: [
        { path: 'orders', label: 'Orders', role: 'ROLE_ADMIN' },
        { path: 'products', label: 'Products', role: 'ROLE_SHOP_PRODUCTS' },
      ] },
      { segment: 'badges', label: 'Badges', pages: [] },
    ])
  })
})

describe('extensionPageDataTemplate', () => {
  test('lists every page-data tab with its role and property, loading its component on demand, and every page-data list by its route name', () => {
    const template = extensionPageDataTemplate([
      { ...shop, pageDataTabs: [{ key: 'formats', label: 'Formats and prices', file: '/ext/formats.vue', forTypesWithProperty: 'variants' }], pageDataLists: [
        { path: '/products/', label: 'Products', forTypesWithProperty: 'variants', columns: [{ label: 'From', file: '/ext/from.vue' }] },
      ] },
      { name: '@acme/store', prefix: 'Store', label: 'Store', pageDataTabs: [{ key: 'stock', label: 'Stock', file: '/ext/stock.vue', forTypesWithProperty: 'stock', role: 'ROLE_STOCK' }] },
    ])

    expect(template).toContain('{ key: "formats", label: "Formats and prices", role: "ROLE_ADMIN", property: "variants", component: defineAsyncComponent(() => import("/ext/formats.vue")) },')
    expect(template).toContain('{ key: "stock", label: "Stock", role: "ROLE_STOCK", property: "stock", component: defineAsyncComponent(() => import("/ext/stock.vue")) },')
    expect(template).toContain('"_cwa-shop-products": { label: "Products", property: "variants", columns: [{ label: "From", component: defineAsyncComponent(() => import("/ext/from.vue")) }] },')
  })
})

describe('extensionPageRoles', () => {
  test('lists each role an extension page needs, once, the default included', () => {
    expect(extensionPageRoles([
      { ...shop, adminPages: [{ path: 'a', label: 'A', file: '/a.vue' }, { path: 'b', label: 'B', file: '/b.vue', role: 'ROLE_SHOP' }] },
      { name: '@acme/store', prefix: 'Store', label: 'Store', adminPages: [{ path: 'c', label: 'C', file: '/c.vue', role: 'ROLE_SHOP' }] },
    ])).toEqual(['ROLE_ADMIN', 'ROLE_SHOP'])
  })
})

describe('extensionAdminRoles (bundle #611)', () => {
  test('lists each role a page declares, once, labelled by the labels of its pages, leaving out the admin default', () => {
    expect(extensionAdminRoles([
      { ...shop, adminPages: [
        { path: 'orders', label: 'Orders', file: '/o.vue' },
        { path: 'accounts', label: 'Accounts', file: '/a.vue', role: 'ROLE_SHOP_ACCOUNTS' },
        { path: 'invoices', label: 'Invoices', file: '/i.vue', role: 'ROLE_SHOP_ACCOUNTS' },
        { path: 'exports', label: 'Exports', file: '/e.vue', role: 'ROLE_SHOP_EXPORTS' },
        { path: 'settings', label: 'Shop settings', file: '/s.vue', role: 'ROLE_ADMIN' },
      ], pageDataLists: [{ path: 'products', label: 'Products', forTypesWithProperty: 'variants', role: 'ROLE_SHOP_PRODUCTS' }], pageDataTabs: [
        { key: 'formats', label: 'Formats and prices', file: '/f.vue', forTypesWithProperty: 'variants', role: 'ROLE_SHOP_PRODUCTS' },
      ] },
    ])).toEqual([
      { role: 'ROLE_SHOP_ACCOUNTS', label: 'Accounts, Invoices' },
      { role: 'ROLE_SHOP_EXPORTS', label: 'Exports' },
      { role: 'ROLE_SHOP_PRODUCTS', label: 'Products, Formats and prices' },
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
