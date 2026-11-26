// @vitest-environment nuxt
import { afterEach, describe, expect, test, vi } from 'vitest'
import { computed } from 'vue'
import * as nuxt from 'nuxt/app'
import { useRouter } from '#app/composables/router'
import cwaAdmin from '../../../middleware/cwa-admin'
import { adminShellRoles } from '#build/cwa-extension-menu'

describe('admin pages ask for the role that manages them (bundle #611)', () => {
  test.each([
    ['_cwa-users-user', {}],
    ['_cwa-users-user-iri', { iri: '/_/users/1' }],
  ])('%s is for user admins', (name, params) => {
    expect(useRouter().resolve({ name, params }).meta.cwaAdminRole).toBe('ROLE_USER_ADMIN')
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

describe('My account opens for everyone the admin header shows for (#508)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  async function guard(roles: string[]) {
    const account = useRouter().resolve({ name: '_cwa-account' })
    vi.spyOn(nuxt, 'useNuxtApp').mockImplementation(() => ({
      $cwa: { auth: { init: vi.fn(), signedIn: computed(() => true), hasRole: (role: string) => roles.includes(role) } },
    }) as never)
    const navigateTo = vi.spyOn(nuxt, 'navigateTo').mockImplementation(() => 'away' as never)
    const result = await cwaAdmin(account, account)
    return { entered: result === undefined, navigateTo }
  }

  test.each([
    ['a content admin', ['ROLE_CMS_ADMIN', 'ROLE_USER']],
    ['a user admin', ['ROLE_USER_ADMIN', 'ROLE_USER']],
    ['a user with only an extension page\'s role', ['ROLE_FIXTURE_REPORTS', 'ROLE_USER']],
  ])('%s opens it', async (_, roles) => {
    const { entered, navigateTo } = await guard(roles)
    expect(entered).toBe(true)
    expect(navigateTo).not.toHaveBeenCalled()
  })

  test('a signed-in user with no admin role is sent home', async () => {
    const { entered, navigateTo } = await guard(['ROLE_USER'])
    expect(entered).toBe(false)
    expect(navigateTo).toHaveBeenCalledWith('/')
  })

  test.each([
    [['ROLE_CMS_ADMIN']],
    [['ROLE_USER_ADMIN']],
    [['ROLE_FIXTURE_REPORTS']],
    [['ROLE_ADMIN']],
    [['ROLE_USER']],
  ])('%j gets the header exactly when the page lets them in, because both read the header\'s roles', async (roles) => {
    expect(useRouter().resolve({ name: '_cwa-account' }).meta.cwaAdminRole).toEqual(adminShellRoles)
    expect((await guard(roles)).entered).toBe(adminShellRoles.some(role => roles.includes(role)))
  })
})
