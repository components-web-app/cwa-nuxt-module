// @vitest-environment nuxt
import { afterEach, describe, expect, test, vi } from 'vitest'
import { useRouter } from '#app/composables/router'
import { cwaAdminRoute } from './cwa-admin-route'

describe('cwaAdminRoute links to an extension\'s admin page by its area segment and page path', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  test('with an IRI it is the page\'s item route, which resolves to the item dialog', () => {
    const to = cwaAdminRoute('fixture', 'orders', '/fixture/orders/1')

    expect(to).toEqual({ name: '_cwa-fixture-orders-iri', params: { iri: '/fixture/orders/1' } })
    expect(useRouter().resolve(to).path).toBe(`/_cwa/fixture/orders/${encodeURIComponent('/fixture/orders/1')}`)
  })

  test('without an IRI it is the list route', () => {
    expect(cwaAdminRoute('fixture', 'orders')).toEqual({ name: '_cwa-fixture-orders' })
    expect(useRouter().resolve(cwaAdminRoute('fixture', 'orders')).path).toBe('/_cwa/fixture/orders')
  })

  test('an unknown page, or an item of a page without one, throws in development', () => {
    vi.stubEnv('DEV', true)

    expect(() => cwaAdminRoute('fixture', 'invoices')).toThrow('cwaAdminRoute: the extension area "fixture" has no admin page "invoices"')
    expect(() => cwaAdminRoute('fixture', 'reports', '/r/1')).toThrow('cwaAdminRoute: the extension area "fixture" has no admin page "reports" with an item page')
  })

  test('outside development it does not look the route up', () => {
    vi.stubEnv('DEV', false)

    expect(cwaAdminRoute('fixture', 'invoices')).toEqual({ name: '_cwa-fixture-invoices' })
  })
})
