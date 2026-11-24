import { createResolver, defineNuxtModule } from '@nuxt/kit'

export default defineNuxtModule({
  meta: { name: 'cwa-fixture-extension' },
  setup(_options, nuxt) {
    const { resolve } = createResolver(import.meta.url)

    nuxt.hook('cwa:extend', (register) => {
      register({
        name: 'cwa-fixture-extension',
        prefix: 'Fixture',
        dir: resolve('./cwa'),
        adminPages: [
          { path: 'fixture-orders', file: resolve('./admin/orders.vue'), menu: { label: 'Orders' } },
          { path: 'fixture-reports', file: resolve('./admin/reports.vue'), role: 'ROLE_FIXTURE_REPORTS', menu: { label: 'Reports' } },
        ],
        pageCache: { '/fixture-basket': false },
      })
    })
  },
})
