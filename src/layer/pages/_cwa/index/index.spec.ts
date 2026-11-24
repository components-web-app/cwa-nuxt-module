// @vitest-environment nuxt
import { describe, test, expect, vi, afterEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { useRouter } from '#app/composables/router'
import CwaAdminParentPage from '../index.vue'

const { mockNavigateTo, mockCwaAdminMiddleware } = vi.hoisted(() => ({
  mockNavigateTo: vi.fn(),
  mockCwaAdminMiddleware: vi.fn(),
}))

vi.mock('#cwa-layer/middleware/cwa-admin', () => ({ default: mockCwaAdminMiddleware }))

mockNuxtImport('navigateTo', () => mockNavigateTo)

describe('/_cwa', () => {
  afterEach(async () => {
    vi.clearAllMocks()
    await useRouter().replace('/')
  })

  test('visiting /_cwa redirects to /_cwa/pages', async () => {
    const router = useRouter()
    await router.push('/_cwa')
    expect(router.currentRoute.value.name).toBe('_cwa-pages')
    expect(router.currentRoute.value.path).toBe('/_cwa/pages')
  })

  test('the redirect lands beneath the guarded /_cwa parent, so route guards and the parent page guard still run', async () => {
    const router = useRouter()
    const guardedPaths: string[] = []
    const removeGuard = router.beforeEach((to) => {
      guardedPaths.push(to.fullPath)
    })
    await router.push('/_cwa')
    removeGuard()
    expect(guardedPaths).toEqual(['/_cwa/pages'])
    expect(router.currentRoute.value.matched.map(record => record.path)).toEqual(['/_cwa', '/_cwa/pages'])
    expect(router.currentRoute.value.matched[0].meta.cwa).toEqual({ disabled: true, admin: true })
    expect(mockCwaAdminMiddleware).toHaveBeenCalledTimes(1)
    expect(mockCwaAdminMiddleware.mock.calls[0][0].fullPath).toBe('/_cwa/pages')
  })

  test('leaves who gets in to the cwa-admin guard, so a user the guard let in for an extension page\'s role is not sent home', async () => {
    mount(CwaAdminParentPage, { shallow: true })
    await flushPromises()
    expect(mockNavigateTo).not.toHaveBeenCalled()
  })
})
