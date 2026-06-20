// @vitest-environment nuxt
import { describe, test, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import RoutesTabView from './RoutesTabView.vue'

function mountView(overrides: Record<string, any> = {}) {
  return mount(RoutesTabView, {
    props: {
      resource: { path: '/topic-1', redirectedFrom: [] },
      isLoading: false,
      ...overrides,
    },
    shallow: true,
  })
}

describe('RoutesTabView', () => {
  describe('section headings', () => {
    test('renders "Forward visitors to" section heading', () => {
      expect(mountView().text()).toContain('Forward visitors to')
    })

    test('renders "Incoming redirects" section heading', () => {
      expect(mountView().text()).toContain('Incoming redirects')
    })
  })

  describe('forward-to section', () => {
    test('shows "None" text and Set button when no forwardToPath', () => {
      const wrapper = mountView({ forwardToPath: undefined })
      expect(wrapper.find('[data-set-forward]').exists()).toBe(true)
      expect(wrapper.find('[data-edit-forward]').exists()).toBe(false)
      expect(wrapper.find('[data-remove-forward]').exists()).toBe(false)
      expect(wrapper.text()).toContain('None')
    })

    test('shows target path, Edit and Remove buttons when forwardToPath is set', () => {
      const wrapper = mountView({ forwardToPath: '/topic-1/chapter-one' })
      expect(wrapper.text()).toContain('/topic-1/chapter-one')
      expect(wrapper.find('[data-edit-forward]').exists()).toBe(true)
      expect(wrapper.find('[data-remove-forward]').exists()).toBe(true)
      expect(wrapper.find('[data-set-forward]').exists()).toBe(false)
    })

    test('Set button emits changePage with "forward-to"', async () => {
      const wrapper = mountView({ forwardToPath: undefined })
      await wrapper.find('[data-set-forward]').trigger('click')
      expect(wrapper.emitted('changePage')?.[0]).toEqual(['forward-to'])
    })

    test('Edit button emits changePage with "forward-to"', async () => {
      const wrapper = mountView({ forwardToPath: '/topic-1/chapter-one' })
      await wrapper.find('[data-edit-forward]').trigger('click')
      expect(wrapper.emitted('changePage')?.[0]).toEqual(['forward-to'])
    })

    test('Remove button emits remove-forward', async () => {
      const wrapper = mountView({ forwardToPath: '/topic-1/chapter-one' })
      await wrapper.find('[data-remove-forward]').trigger('click')
      expect(wrapper.emitted('removeForward')).toBeTruthy()
    })
  })
})
