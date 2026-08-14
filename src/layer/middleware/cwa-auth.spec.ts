// @vitest-environment nuxt
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { RouteLocationNormalizedLoaded } from 'vue-router'
import { computed, ref } from 'vue'
import cwaAuthMiddleware from './cwa-auth'
import * as nuxt from 'nuxt/app'

function createRoute(fullPath = '/members/area'): RouteLocationNormalizedLoaded {
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

function mockCwa({ signedIn }: { signedIn: boolean }) {
  const init = vi.fn()
  vi.spyOn(nuxt, 'useNuxtApp').mockImplementation(() => ({
    $cwa: {
      auth: {
        init,
        signedIn: computed(() => signedIn),
        isAdmin: computed(() => false),
        user: ref(undefined),
      },
    },
  }) as never)
  return { init }
}

describe('cwa-auth middleware', () => {
  beforeEach(() => {
    vi.spyOn(nuxt, 'navigateTo').mockImplementation(() => 'navigateToResponse' as never)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('lets a signed-in visitor through', async () => {
    mockCwa({ signedIn: true })
    const result = await cwaAuthMiddleware(createRoute(), createRoute())
    expect(result).toBeUndefined()
    expect(nuxt.navigateTo).not.toHaveBeenCalled()
  })

  test('sends a signed-out visitor to login, carrying where they were going', async () => {
    mockCwa({ signedIn: false })
    await cwaAuthMiddleware(createRoute('/members/area?tab=2'), createRoute())
    expect(nuxt.navigateTo).toHaveBeenCalledWith({
      path: '/login',
      query: { redirect: '/members/area?tab=2' },
    })
  })

  // Without this the cookie alone decides, and the cookie can outlive the session — a signed-out
  // visitor with a stale cookie would be waved through to a page that then fails to load anything.
  test('resolves the session before deciding', async () => {
    const { init } = mockCwa({ signedIn: true })
    await cwaAuthMiddleware(createRoute(), createRoute())
    expect(init).toHaveBeenCalled()
  })
})
