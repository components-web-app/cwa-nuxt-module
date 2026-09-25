// @vitest-environment nuxt
import { describe, test, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import RouteListRow from './RouteListRow.vue'
import { formatDateTime } from '#cwa/resources/date-time-input'

function mountRow(data: Record<string, any> = {}) {
  return mount(RouteListRow, {
    props: {
      data: {
        '@id': '/_/routes//topic-1',
        '@type': 'Route',
        'path': '/topic-1',
        'page': '/_/pages/abc',
        ...data,
      },
      linkFn: (iri: string) => iri,
      associatedResources: { page: 'My Page' },
    } as any,
    shallow: true,
  })
}

describe('RouteListRow', () => {
  describe('publication state', () => {
    test('answers why a route is missing from the site when it has no go-live date', () => {
      expect(mountRow({ liveAt: undefined }).find('[data-route-publication]').text()).toContain('Not live')
    })

    test('shows when a scheduled route goes live', () => {
      const liveAt = '2999-01-01T09:00:00Z'
      const text = mountRow({ liveAt, _metadata: { persisted: true, effectiveLiveAt: liveAt } }).find('[data-route-publication]').text()
      expect(text).toContain('Scheduled')
      expect(text).toContain(formatDateTime(liveAt))
    })

    test('shows a route with a past go-live date as live', () => {
      const liveAt = '2020-01-01T00:00:00+00:00'
      expect(mountRow({ liveAt, _metadata: { persisted: true, effectiveLiveAt: liveAt } }).find('[data-route-publication]').text()).toContain('Live')
    })

    test('lists a live child route whose parent goes live next week as not yet reachable', () => {
      const effectiveLiveAt = '2999-01-01T09:00:00Z'
      const text = mountRow({ liveAt: '2020-01-01T00:00:00+00:00', _metadata: { persisted: true, effectiveLiveAt } }).find('[data-route-publication]').text()
      expect(text).toContain('Scheduled')
      expect(text).toContain(formatDateTime(effectiveLiveAt))
      expect(text).not.toContain('Live')
    })

    test('reports a route the API resolved no effective date for as not live', () => {
      const text = mountRow({ liveAt: '2020-01-01T00:00:00+00:00', _metadata: { persisted: true } }).find('[data-route-publication]').text()
      expect(text).toContain('Not live')
    })
  })
})
