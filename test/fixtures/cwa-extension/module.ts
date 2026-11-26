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
        pageCache: { '/fixture-basket': false, '/fixture-account/**': false },
      })
    })
  },
})
