// @vitest-environment nuxt
import { describe, expect, test } from 'vitest'
import { useRouter } from '#app/composables/router'

describe('admin pages ask for the role that manages them (bundle #611)', () => {
  test.each([
    ['_cwa-users-user', {}],
    ['_cwa-users-user-iri', { iri: '/_/users/1' }],
  ])('%s is for user admins', (name, params) => {
    expect(useRouter().resolve({ name, params }).meta.cwaAdminRole).toBe('ROLE_USER_ADMIN')
  })

  test('_cwa-account opens for any admin, not only content admins', () => {
    expect(useRouter().resolve({ name: '_cwa-account' }).meta.cwaAdminRole).toBe('ROLE_ADMIN')
  })

  test.each(['/_cwa/layouts', '/_cwa/pages', '/_cwa/routes', '/_cwa/settings', '/_cwa/orphaned'])('%s declares no role, so it is for content admins, the guard\'s default', (path) => {
    expect(useRouter().resolve(path).meta.cwaAdminRole).toBeUndefined()
  })
})

describe('an extension\'s admin area', () => {
  test('the fixture\'s orders page is in its area, named from its prefix and page path, with a keyed item route', () => {
    const router = useRouter()

    expect(router.resolve({ name: '_cwa-fixture' }).path).toBe('/_cwa/fixture')
    expect(router.resolve({ name: '_cwa-fixture-orders' }).path).toBe('/_cwa/fixture/orders')
    const item = router.resolve({ name: '_cwa-fixture-orders-iri', params: { iri: '/fixture/orders/1' } })
    expect(item.meta.key).toBe('_cwa-fixture-orders-iri')
    expect(item.matched.map(record => record.name).slice(1)).toEqual(['_cwa-fixture', '_cwa-fixture-orders', '_cwa-fixture-orders-iri'])
  })

  test('the area opens for any role one of its pages needs, and each page asks for its own', () => {
    const router = useRouter()

    expect(router.resolve('/_cwa/fixture').meta.cwaAdminRole).toEqual(['ROLE_ADMIN', 'ROLE_FIXTURE_REPORTS'])
    expect(router.resolve('/_cwa/fixture/reports').meta.cwaAdminRole).toBe('ROLE_FIXTURE_REPORTS')
  })

  test('the Extensions page opens for admins and for every role an extension page needs', () => {
    expect(useRouter().resolve('/_cwa/extensions').meta.cwaAdminRole).toEqual(['ROLE_ADMIN', 'ROLE_FIXTURE_REPORTS'])
  })
})
