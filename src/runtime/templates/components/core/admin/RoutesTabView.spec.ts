// @vitest-environment nuxt
import { describe, test, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import RoutesTabView from './RoutesTabView.vue'
import { formatRouteLiveAt } from '#cwa/resources/route-publication'

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

  describe('publication state', () => {
    test('answers why nobody can see a page whose route has no go-live date', () => {
      const wrapper = mountView({ resource: { path: '/topic-1', redirectedFrom: [] } })
      expect(wrapper.find('[data-route-publication]').text()).toContain('Not live')
    })

    test('shows when a scheduled route goes live', () => {
      const liveAt = '2999-01-01T09:00:00Z'
      const wrapper = mountView({ resource: { path: '/topic-1', redirectedFrom: [], liveAt } })
      const text = wrapper.find('[data-route-publication]').text()
      expect(text).toContain('Scheduled')
      expect(text).toContain(formatRouteLiveAt(liveAt))
    })

    test('shows a route with a past go-live date as live', () => {
      const wrapper = mountView({ resource: { path: '/topic-1', redirectedFrom: [], liveAt: '2020-01-01T00:00:00+00:00' } })
      expect(wrapper.find('[data-route-publication]').text()).toContain('Live')
    })

    test('says nothing about visibility when the page has no route yet', () => {
      const wrapper = mountView({ resource: undefined })
      expect(wrapper.find('[data-route-publication]').exists()).toBe(false)
    })

    test('says nothing about visibility while the route is still loading', () => {
      const wrapper = mountView({ isLoading: true })
      expect(wrapper.find('[data-route-publication]').exists()).toBe(false)
    })

    test('warns that a live child route still depends on its parents being live', () => {
      const wrapper = mountView({
        resource: { path: '/topic-1', redirectedFrom: [], liveAt: '2020-01-01T00:00:00+00:00' },
        hasParentPage: true,
      })
      expect(wrapper.find('[data-parent-live-note]').exists()).toBe(true)
    })

    test('does not mention parents for a route with no parent page', () => {
      const wrapper = mountView({
        resource: { path: '/topic-1', redirectedFrom: [], liveAt: '2020-01-01T00:00:00+00:00' },
        hasParentPage: false,
      })
      expect(wrapper.find('[data-parent-live-note]').exists()).toBe(false)
    })
  })

  describe('a parent route holding the page back', () => {
    const gatedChild = {
      path: '/conference/programme',
      redirectedFrom: [],
      liveAt: '2020-01-01T00:00:00+00:00',
      effectiveLiveAt: '2999-01-01T09:00:00Z',
    }

    test('a live child route whose parent goes live next week reads as not yet reachable', () => {
      const text = mountView({ resource: gatedChild, hasParentPage: true }).find('[data-route-publication]').text()
      expect(text).toContain('Scheduled')
      expect(text).toContain(formatRouteLiveAt(gatedChild.effectiveLiveAt))
      expect(text).not.toContain('Live')
    })

    test('explains that it is a parent route setting that date', () => {
      const wrapper = mountView({ resource: gatedChild, hasParentPage: true })
      expect(wrapper.find('[data-parent-gated]').exists()).toBe(true)
    })

    test('says nothing about parents when the effective date matches the route own date', () => {
      const wrapper = mountView({
        resource: { path: '/topic-1', redirectedFrom: [], liveAt: '2020-01-01T00:00:00+00:00', effectiveLiveAt: '2020-01-01T00:00:00+00:00' },
        hasParentPage: true,
      })
      expect(wrapper.find('[data-route-publication]').text()).toContain('Live')
      expect(wrapper.find('[data-parent-gated]').exists()).toBe(false)
    })

    test('drops the unconditional parent hedge once the API tells us the effective date', () => {
      const wrapper = mountView({
        resource: { path: '/topic-1', redirectedFrom: [], liveAt: '2020-01-01T00:00:00+00:00', effectiveLiveAt: '2020-01-01T00:00:00+00:00' },
        hasParentPage: true,
      })
      expect(wrapper.find('[data-parent-live-note]').exists()).toBe(false)
    })

    test('keeps the parent hedge when an older API exposes no effective date', () => {
      const wrapper = mountView({
        resource: { path: '/topic-1', redirectedFrom: [], liveAt: '2020-01-01T00:00:00+00:00' },
        hasParentPage: true,
      })
      expect(wrapper.find('[data-parent-live-note]').exists()).toBe(true)
      expect(wrapper.find('[data-route-publication]').text()).toContain('Live')
    })
  })
})
