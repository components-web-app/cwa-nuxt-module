// @vitest-environment nuxt
import { describe, expect, test, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import UsersListPage from './users.vue'

vi.mock('#cwa-layer/_composables/useListPage', () => ({
  useListPage: () => ({ goToAdd: vi.fn(), triggerReload: vi.fn(), computedItemLink: vi.fn() }),
}))

describe('/_cwa/users', () => {
  test('opens a user in the kit dialog without the old overlay around it', () => {
    const wrapper = mount(UsersListPage, { shallow: true })

    expect(wrapper.findComponent({ name: 'ResourceModalOverlay' }).props('overlay')).toBe(false)
  })
})
