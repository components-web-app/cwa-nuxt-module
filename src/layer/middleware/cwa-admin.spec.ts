// @vitest-environment nuxt
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { RouteLocationNormalizedLoaded } from 'vue-router'
import { computed } from 'vue'
import cwaAdminMiddleware from './cwa-admin'
import * as nuxt from 'nuxt/app'

function createRoute(fullPath = '/reports'): RouteLocationNormalizedLoaded {
  return {
    name: '',
    path: fullPath,
    fullPath,
    query: {},
    hash: '',
    matched: [],
    params: {},
    meta: {},
    redirectedFrom: undefined,
  }
}

function mockCwa({ signedIn, isAdmin }: { signedIn: boolean, isAdmin: boolean }) {
  const init = vi.fn()
  vi.spyOn(nuxt, 'useNuxtApp').mockImplementation(() => ({
    $cwa: {
      auth: {
        init,
        signedIn: computed(() => signedIn),
        isAdmin: computed(() => isAdmin),
      },
    },
  }) as never)
  return { init }
}

describe('cwa-admin middleware', () => {
  beforeEach(() => {
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

  // Mirrors the long-standing guard in `_cwa/index.vue` — a signed-in non-admin is not going to
  // gain the role by logging in again, so bouncing them to login would be a loop, not a fix.
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

  // `isAdmin` reads roles off the fetched user, which is populated by init(). Deciding before that
  // resolves would bounce a legitimate admin off their own page on a server-rendered load.
  test('resolves the user before deciding, so an admin is never wrongly bounced', async () => {
    const { init } = mockCwa({ signedIn: true, isAdmin: true })
    await cwaAdminMiddleware(createRoute(), createRoute())
    expect(init).toHaveBeenCalled()
  })
})
