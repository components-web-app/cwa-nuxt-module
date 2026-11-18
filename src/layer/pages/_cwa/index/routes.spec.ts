// @vitest-environment nuxt
import { describe, expect, test, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import RoutesListPage from './routes.vue'

vi.mock('#cwa-layer/_composables/useListPage', () => ({
  useListPage: () => ({ triggerReload: vi.fn(), computedItemLink: vi.fn() }),
}))

mockNuxtImport('useCwa', () => () => ({ resourcesManager: { deleteResource: vi.fn() } }))

describe('/_cwa/routes', () => {
  test('opens a route\'s page in the kit dialog without the old overlay around it', () => {
    const wrapper = mount(RoutesListPage, { shallow: true })

    expect(wrapper.findComponent({ name: 'ResourceModalOverlay' }).props('overlay')).toBe(false)
  })

  test('the Status column fits the widest status badge, Inherited scheduled with its date (#461)', () => {
    const wrapper = mount(RoutesListPage, { shallow: true })
    const status = wrapper.findComponent({ name: 'ListContent' }).props('columns').find((column: { label: string }) => column.label === 'Status')
    expect(status.width).toBe('17.5rem')
  })
})
