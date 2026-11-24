// @vitest-environment nuxt
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { RouteLocationNormalizedLoaded } from 'vue-router'
import { computed } from 'vue'
import cwaAdminMiddleware from './cwa-admin'
import * as nuxt from 'nuxt/app'
import * as processComposables from '#cwa/composables/process'

function createRoute(fullPath = '/reports', meta: Record<string, unknown> = {}): RouteLocationNormalizedLoaded {
  return {
    name: '',
    path: fullPath,
    fullPath,
    query: {},
    hash: '',
    matched: [],
    params: {},
    meta,
    redirectedFrom: undefined,
  }
}

function mockCwa({ signedIn, isAdmin, roles = isAdmin ? ['ROLE_ADMIN'] : [] }: { signedIn: boolean, isAdmin: boolean, roles?: string[] }) {
  const init = vi.fn()
  const hasRole = vi.fn((role: string) => roles.includes(role))
  vi.spyOn(nuxt, 'useNuxtApp').mockImplementation(() => ({
    $cwa: {
      auth: {
        init,
        signedIn: computed(() => signedIn),
        isAdmin: computed(() => isAdmin),
        hasRole,
      },
    },
  }) as never)
  return { init, hasRole }
}

describe('cwa-admin middleware', () => {
  beforeEach(() => {
    vi.spyOn(processComposables, 'useProcess').mockReturnValue({ isClient: true, isServer: false })
    vi.spyOn(nuxt, 'navigateTo').mockImplementation(() => 'navigateToResponse' as never)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('lets an admin through', async () => {
    mockCwa({ signedIn: true, isAdmin: true })
    const result = await cwaAdminMiddleware(createRoute(), createRoute())
    expect(result).toBeUndefined()
    expect(nuxt.navigateTo).not.toHaveBeenCalled()
  })

  test('sends a signed-in non-admin home, not to login', async () => {
    mockCwa({ signedIn: true, isAdmin: false })
    await cwaAdminMiddleware(createRoute(), createRoute())
    expect(nuxt.navigateTo).toHaveBeenCalledWith('/')
  })

  test('sends a signed-out visitor to login, carrying where they were going', async () => {
    mockCwa({ signedIn: false, isAdmin: false })
    await cwaAdminMiddleware(createRoute('/reports?range=30d'), createRoute())
    expect(nuxt.navigateTo).toHaveBeenCalledWith({
      path: '/login',
      query: { redirect: '/reports?range=30d' },
    })
  })

  test('resolves the user before deciding, so an admin is never wrongly bounced', async () => {
    const { init } = mockCwa({ signedIn: true, isAdmin: true })
    await cwaAdminMiddleware(createRoute(), createRoute())
    expect(init).toHaveBeenCalled()
  })

  describe('an extension admin page that declares a role', () => {
    const accounts = { cwaAdminRole: 'ROLE_SHOP_ACCOUNTS' }

    test('lets in a signed-in user who has the role without being an admin', async () => {
      const { hasRole } = mockCwa({ signedIn: true, isAdmin: false, roles: ['ROLE_SHOP_ACCOUNTS'] })
      const result = await cwaAdminMiddleware(createRoute('/_cwa/reports', accounts), createRoute())
      expect(hasRole).toHaveBeenCalledWith('ROLE_SHOP_ACCOUNTS')
      expect(result).toBeUndefined()
      expect(nuxt.navigateTo).not.toHaveBeenCalled()
    })

    test('sends home an admin who lacks the role', async () => {
      mockCwa({ signedIn: true, isAdmin: true })
      await cwaAdminMiddleware(createRoute('/_cwa/reports', accounts), createRoute())
      expect(nuxt.navigateTo).toHaveBeenCalledWith('/')
    })

    test('treats a declared ROLE_ADMIN as the admin check, so a super admin still gets in', async () => {
      mockCwa({ signedIn: true, isAdmin: true, roles: ['ROLE_SUPER_ADMIN'] })
      const result = await cwaAdminMiddleware(createRoute('/_cwa/orders', { cwaAdminRole: 'ROLE_ADMIN' }), createRoute())
      expect(result).toBeUndefined()
    })
  })

  describe('on the server, where a cross-origin API cookie is not sent', () => {
    beforeEach(() => {
      vi.spyOn(processComposables, 'useProcess').mockReturnValue({ isClient: false, isServer: true })
    })

    test('does not redirect a visitor it cannot see signed in, and leaves the decision to the browser', async () => {
      const { init } = mockCwa({ signedIn: false, isAdmin: false })
      const result = await cwaAdminMiddleware(createRoute('/reports'), createRoute())
      expect(init).toHaveBeenCalled()
      expect(result).toBeUndefined()
      expect(nuxt.navigateTo).not.toHaveBeenCalled()
    })

    test('still sends a signed-in non-admin home, because the server knows who they are', async () => {
      mockCwa({ signedIn: true, isAdmin: false })
      await cwaAdminMiddleware(createRoute(), createRoute())
      expect(nuxt.navigateTo).toHaveBeenCalledWith('/')
    })
  })
})
