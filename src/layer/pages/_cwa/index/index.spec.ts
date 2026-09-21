// @vitest-environment nuxt
import { describe, test, expect, vi, afterEach } from 'vitest'
import { computed } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { useRouter } from '#app/composables/router'
import CwaAdminParentPage from '../index.vue'

const { mockNavigateTo, adminState } = vi.hoisted(() => ({
  mockNavigateTo: vi.fn(),
  adminState: { isAdmin: false },
}))

mockNuxtImport('navigateTo', () => mockNavigateTo)
mockNuxtImport('useCwa', () => () => ({
  auth: { isAdmin: computed(() => adminState.isAdmin) },
}))

describe('/_cwa', () => {
  afterEach(async () => {
    vi.clearAllMocks()
    adminState.isAdmin = false
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
  })

  test('a non-admin reaching the admin area is sent home', async () => {
    adminState.isAdmin = false
    mount(CwaAdminParentPage, { shallow: true })
    await flushPromises()
    expect(mockNavigateTo).toHaveBeenCalledWith('/')
  })

  test('an admin reaching the admin area stays', async () => {
    adminState.isAdmin = true
    mount(CwaAdminParentPage, { shallow: true })
    await flushPromises()
    expect(mockNavigateTo).not.toHaveBeenCalled()
  })
})
