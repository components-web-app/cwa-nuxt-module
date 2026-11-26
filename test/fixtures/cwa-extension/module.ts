import { createResolver, defineNuxtModule } from '@nuxt/kit'

export default defineNuxtModule({
  meta: { name: 'cwa-fixture-extension' },
  setup(_options, nuxt) {
    const { resolve } = createResolver(import.meta.url)

    nuxt.hook('cwa:extend', (register) => {
      register({
        name: 'cwa-fixture-extension',
        prefix: 'Fixture',
        label: 'Fixture shop',
        description: 'Orders and reports',
        icon: 'lucide:shopping-cart',
        dir: resolve('./cwa'),
        adminPages: [
          { path: 'orders', label: 'Orders', file: resolve('./admin/orders.vue'), item: resolve('./admin/order.vue') },
          { path: 'reports', label: 'Reports', file: resolve('./admin/reports.vue'), role: 'ROLE_FIXTURE_REPORTS' },
        ],
        pageDataTabs: [
          { key: 'formats', label: 'Formats and prices', file: resolve('./admin/formats.vue'), forTypesWithProperty: 'variants' },
        ],
        pageDataLists: [
          { path: 'products', label: 'Products', forTypesWithProperty: 'variants', columns: [{ label: 'From', file: resolve('./admin/from-price.vue') }] },
        ],
        pageCache: { '/fixture-basket': false, '/fixture-account/**': false },
      })
    })
  },
})
