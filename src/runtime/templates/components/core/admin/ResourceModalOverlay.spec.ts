// @vitest-environment nuxt
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ResourceModalOverlay from './ResourceModalOverlay.vue'
import ResourceModalOverlayTemplate from './ResourceModalOverlayTemplate.vue'

const { mockRoute, push } = vi.hoisted(() => ({
  mockRoute: { name: '_cwa-routes-iri', params: { iri: '/_/pages/uuid' } as Record<string, string>, query: { page: '2' } },
  push: vi.fn(),
}))

vi.mock('vue-router', async (importOriginal) => {
  const mod = await importOriginal<typeof import('vue-router')>()
  return { ...mod, useRoute: () => mockRoute, useRouter: () => ({ push }) }
})

const NuxtPage = { name: 'NuxtPage', emits: ['close', 'reload'], template: '<div data-testid="child-page" />' }

function mountOverlay(props: Record<string, unknown> = {}) {
  return mount(ResourceModalOverlay, { props, global: { stubs: { NuxtPage } } })
}

describe('ResourceModalOverlay', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('wraps the item page in the overlay by default', () => {
    const wrapper = mountOverlay()

    expect(wrapper.findComponent(ResourceModalOverlayTemplate).props('show')).toBe(true)
    expect(wrapper.findComponent(ResourceModalOverlayTemplate).find('[data-testid="child-page"]').exists()).toBe(true)
  })

  test('without the overlay, an item page that portals its own dialog renders bare and still closes to the list', async () => {
    const wrapper = mountOverlay({ overlay: false })

    expect(wrapper.findComponent(ResourceModalOverlayTemplate).exists()).toBe(false)
    const page = wrapper.findComponent({ name: 'NuxtPage' })
    expect(page.exists()).toBe(true)

    page.vm.$emit('close')
    page.vm.$emit('reload')

    expect(push).toHaveBeenCalledWith({ name: '_cwa-routes', query: { page: '2' } })
    expect(wrapper.emitted('reload')).toHaveLength(1)
  })

  test('closes to the list whose name the item route ends with, even when the list\'s own name holds -iri, as an extension\'s may', () => {
    mockRoute.name = '_cwa-shop-sku-iris-iri'
    const page = mountOverlay({ overlay: false }).findComponent({ name: 'NuxtPage' })

    page.vm.$emit('close')

    expect(push).toHaveBeenCalledWith({ name: '_cwa-shop-sku-iris', query: { page: '2' } })
    mockRoute.name = '_cwa-routes-iri'
  })
})
