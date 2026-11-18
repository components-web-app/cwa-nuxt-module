// @vitest-environment nuxt
import { describe, test, expect, vi, afterEach } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import RoutesTabView from './RoutesTabView.vue'
import { formatDateTime } from '#cwa/resources/date-time-input'
import { axe } from '../../../../../../test/utils/axe'
import { drawsFocusRing } from '../../../../../../test/utils/focus-ring'

enableAutoUnmount(afterEach)

function mountView(overrides: Record<string, any> = {}) {
  return mount(RoutesTabView, {
    props: {
      resource: { path: '/topic-1', redirectedFrom: [] },
      isLoading: false,
      ...overrides,
    },
    attachTo: document.body,
  })
}

const badge = (wrapper: ReturnType<typeof mountView>) => wrapper.find('[data-route-publication]')
const rowTexts = (wrapper: ReturnType<typeof mountView>) => wrapper.findAll('[data-nav]').map(row => row.text().replace(/\s+/g, ' ').trim())

describe('RoutesTabView', () => {
  describe('a page with a route', () => {
    test('shows the path under its label with Copy and its status, then Edit route below', () => {
      const wrapper = mountView()
      expect(wrapper.find('dt').text()).toBe('Path')
      expect(wrapper.find('[data-testid="routes-path"]').text()).toBe('/topic-1')
      expect(wrapper.find('[data-testid="routes-copy"]').attributes('aria-label')).toBe('Copy path')
      expect(wrapper.find('[data-testid="routes-edit"]').text()).toBe('Edit route')
      expect(wrapper.find('[data-testid="routes-none"]').exists()).toBe(false)
    })

    test('Copy writes the path to the clipboard', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined)
      vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
      const wrapper = mountView()
      await wrapper.find('[data-testid="routes-copy"]').trigger('click')
      expect(writeText).toHaveBeenCalledWith('/topic-1')
      vi.unstubAllGlobals()
    })

    test('Edit route opens the route sub-view', async () => {
      const wrapper = mountView()
      await wrapper.find('[data-testid="routes-edit"]').trigger('click')
      expect(wrapper.emitted('open')).toEqual([['route']])
    })

    test('offers the recommended path when it differs, and Use this opens the route form filled with it', async () => {
      const wrapper = mountView({ recommendedPath: '/topic-one' })
      expect(wrapper.find('[data-testid="route-recommendation"]').text()).toContain('Recommended: /topic-one')
      const use = wrapper.find('[data-testid="route-use-recommended"]')
      expect(use.attributes('aria-label')).toBe('Use this: the recommended path, /topic-one')
      await use.trigger('click')
      expect(wrapper.emitted('open')).toEqual([['route', true]])
    })

    test('renders no recommendation when the path is the recommended one', () => {
      expect(mountView({ recommendedPath: '/topic-1' }).find('[data-testid="route-recommendation"]').exists()).toBe(false)
    })

    test('lists Redirect to, Redirected from and Child routes as rows named by their label and summary', () => {
      const wrapper = mountView({ redirectCount: 3, childCount: 1 })
      expect(rowTexts(wrapper)).toEqual(['Redirect to: Off', 'Redirected from: 3 old addresses', 'Child routes: 1 route'])
      expect(wrapper.find('[data-testid="routes-rows"]').attributes('aria-label')).toBe('More route settings')
    })

    test('a redirecting route summarises where it sends visitors', () => {
      const wrapper = mountView({ forwardToPath: '/kitchens/range' })
      expect(rowTexts(wrapper)[0]).toBe('Redirect to: → to /kitchens/range')
    })

    test('says None when there is nothing in a row', () => {
      expect(rowTexts(mountView())).toEqual(['Redirect to: Off', 'Redirected from: None', 'Child routes: None'])
    })

    test.each([['to'], ['from'], ['kids']])('the %s row opens its sub-view', async (view) => {
      const wrapper = mountView()
      await wrapper.find(`[data-nav="${view}"]`).trigger('click')
      expect(wrapper.emitted('open')).toEqual([[view]])
    })

    test('rows, Edit route and Copy draw their focus ring', () => {
      const wrapper = mountView({ recommendedPath: '/topic-one' })
      for (const element of [...wrapper.findAll('[data-nav]'), wrapper.find('[data-testid="routes-edit"]'), wrapper.find('[data-testid="routes-copy"]'), wrapper.find('[data-testid="route-use-recommended"]')]) {
        expect(drawsFocusRing(element.classes())).toBe(true)
      }
    })

    test('shows the outcome of a route change with a tick, where focus can go', () => {
      const wrapper = mountView({ status: 'Route changed to /topic-2.' })
      const status = wrapper.find('[data-testid="routes-status"]')
      expect(status.text()).toBe('Route changed to /topic-2.')
      expect(status.attributes('role')).toBe('status')
      expect(status.attributes('tabindex')).toBe('-1')
      expect((wrapper.vm as unknown as { statusElement: () => HTMLElement | null }).statusElement()).toBe(status.element)
    })

    test('has no axe violations', async () => {
      const wrapper = mountView({ recommendedPath: '/topic-one', redirectCount: 2, status: 'Route saved.' })
      await flushPromises()
      expect(await axe(wrapper.element as HTMLElement)).toHaveNoViolations()
    })
  })

  describe('a page with no route', () => {
    test('says so instead of showing a Path label, offers Add a route, and hides Redirect to and Redirected from', async () => {
      const wrapper = mountView({ resource: undefined, recommendedPath: '/topic-one' })
      expect(wrapper.find('dt').exists()).toBe(false)
      expect(wrapper.find('[data-testid="routes-none"]').text()).toBe('No route yet. Visitors can\'t open this page at its own address.')
      expect(rowTexts(wrapper)).toEqual(['Child routes: None'])
      expect(badge(wrapper).exists()).toBe(false)
      await wrapper.find('[data-testid="routes-add"]').trigger('click')
      await wrapper.find('[data-testid="route-use-recommended"]').trigger('click')
      expect(wrapper.emitted('open')).toEqual([['route'], ['route', true]])
    })

    test('says it is still reachable through a nested page when a child route makes it public', () => {
      const wrapper = mountView({ resource: undefined, childCount: 2 })
      expect(wrapper.find('[data-testid="routes-none"]').text()).toContain('It is reachable through a nested page.')
    })

    test('under a parent with no route, it names the parent and opens it instead of adding a route, with no rows', async () => {
      const wrapper = mountView({ resource: undefined, parentHasNoRoute: true, parentName: 'Conference' })
      expect(wrapper.find('[data-testid="routes-add"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="routes-parent-none"]').text()).toContain('The parent page, Conference, has no route yet.')
      expect(wrapper.find('[data-testid="routes-rows"]').exists()).toBe(false)
      await wrapper.find('[data-testid="routes-open-parent"]').trigger('click')
      expect(wrapper.emitted('openParent')).toHaveLength(1)
      expect(await axe(wrapper.element as HTMLElement)).toHaveNoViolations()
    })
  })

  describe('while loading', () => {
    test('shows a spinner, no status and no rows', () => {
      const wrapper = mountView({ isLoading: true })
      expect(badge(wrapper).exists()).toBe(false)
      expect(wrapper.find('[data-testid="routes-rows"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="routes-view"]').attributes('aria-busy')).toBe('true')
    })
  })

  describe('publication state', () => {
    test('answers why nobody can see a page whose route has no go-live date', () => {
      expect(badge(mountView({ resource: { path: '/topic-1', redirectedFrom: [] } })).text()).toBe('Not live')
    })

    test('shows when a scheduled route goes live', () => {
      const liveAt = '2999-01-01T09:00:00Z'
      const text = badge(mountView({ resource: { path: '/topic-1', redirectedFrom: [], liveAt, _metadata: { persisted: true, effectiveLiveAt: liveAt } } })).text()
      expect(text).toBe(`Scheduled · ${formatDateTime(liveAt)}`)
    })

    test('shows a route with a past go-live date as live', () => {
      const liveAt = '2020-01-01T00:00:00+00:00'
      expect(badge(mountView({ resource: { path: '/topic-1', redirectedFrom: [], liveAt, _metadata: { persisted: true, effectiveLiveAt: liveAt } } })).text()).toBe('Live')
    })

    test('reports a route the API resolved no effective date for, with no own date either, as not live', () => {
      expect(badge(mountView({ resource: { path: '/topic-1', redirectedFrom: [], liveAt: null, _metadata: { persisted: true } } })).text()).toBe('Not live')
    })
  })

  describe('a parent route holding the page back', () => {
    const gatedChild = {
      path: '/conference/programme',
      redirectedFrom: [],
      liveAt: '2020-01-01T00:00:00+00:00',
      _metadata: { persisted: true, effectiveLiveAt: '2999-01-01T09:00:00Z' },
    }

    test('a live child route whose parent goes live next week reads as held back by its parent, not live', () => {
      const text = badge(mountView({ resource: gatedChild })).text()
      expect(text).toBe('Held back by parent')
    })

    test('explains that a parent route sets the date visitors can reach it', () => {
      const note = mountView({ resource: gatedChild }).find('[data-parent-gated]')
      expect(note.text()).toContain('Held back by a parent route.')
      expect(note.text()).toContain(formatDateTime(gatedChild._metadata.effectiveLiveAt))
      expect(note.attributes('data-tone')).toBe('warning')
    })

    test('names a draft ancestor as the reason rather than leaving it unexplained', () => {
      const wrapper = mountView({
        resource: { path: '/topic-1', redirectedFrom: [], liveAt: '2020-01-01T00:00:00+00:00', _metadata: { persisted: true } },
      })
      expect(badge(wrapper).text()).toBe('Held back by parent')
      expect(wrapper.find('[data-parent-gated]').text()).toContain('no go-live date')
    })

    test('says nothing about parents when the effective date matches the route own date', () => {
      const liveAt = '2020-01-01T00:00:00+00:00'
      const wrapper = mountView({
        resource: { path: '/topic-1', redirectedFrom: [], liveAt, _metadata: { persisted: true, effectiveLiveAt: liveAt } },
      })
      expect(badge(wrapper).text()).toBe('Live')
      expect(wrapper.find('[data-parent-gated]').exists()).toBe(false)
    })

    describe('once the parent date has passed', () => {
      afterEach(() => {
        vi.useRealTimers()
      })

      test('reads as live with no parent note (#378)', () => {
        vi.useFakeTimers().setSystemTime(new Date('2026-09-20T12:00:00.000Z'))
        const wrapper = mountView({
          resource: { path: '/topic-1', redirectedFrom: [], liveAt: '2026-09-01T07:05:00Z', _metadata: { persisted: true, effectiveLiveAt: '2026-09-01T07:07:00Z' } },
        })
        expect(badge(wrapper).text()).toBe('Live')
        expect(wrapper.find('[data-parent-gated]').exists()).toBe(false)
      })
    })
  })
})
