// @vitest-environment happy-dom
import { describe, expect, test } from 'vitest'
import { mount } from '@vue/test-utils'
import PageListStatus from './PageListStatus.vue'
import { formatDateTime } from '#cwa/resources/date-time-input'
import { axe } from '../../../../../../test/utils/axe'

const now = new Date('2026-11-18T12:00:00Z')

function mountStatus(resource: Record<string, any>, route?: Record<string, any>, known = true, extra: Record<string, unknown> = {}) {
  return mount(PageListStatus, { props: { resource: { '@id': '/_/pages/1', ...resource } as any, route: route as any, known, now, ...extra } })
}

function status(resource: Record<string, any>, route?: Record<string, any>, known = true, extra: Record<string, unknown> = {}) {
  return mountStatus(resource, route, known, extra).text()
}

describe('PageListStatus (#461)', () => {
  test('a template says how many pages are built from it, or that none are', () => {
    expect(status({ isTemplate: true }, undefined, true, { pageDataCount: 14 })).toBe('Template · 14 pages')
    expect(status({ isTemplate: true }, undefined, true, { pageDataCount: 1 })).toBe('Template · 1 page')
    expect(status({ isTemplate: true }, undefined, true, { pageDataCount: 0 })).toBe('Template · unused')
  })

  test('a template counts what it is given from the list, never the resource\'s own copy', () => {
    expect(status({ isTemplate: true, _metadata: { pageDataCount: 0 } }, undefined, true, { pageDataCount: 14 })).toBe('Template · 14 pages')
  })

  test('a template the API sends no count for says Template', () => {
    expect(status({ isTemplate: true, _metadata: {} })).toBe('Template')
  })

  test('a page without a route says so, or that it is public without one', () => {
    expect(status({})).toBe('No route')
    expect(status({ isReachableWithoutRoute: true })).toBe('Public without a route')
  })

  test('a routed page shows its route\'s status once the routes are known', () => {
    const route = { liveAt: '2026-11-01T00:00:00Z', _metadata: { effectiveLiveAt: '2026-11-01T00:00:00Z' } }

    expect(status({ route: '/_/routes/x' }, route)).toBe('Live')
    expect(status({ route: '/_/routes/x' }, undefined)).toBe('')
  })

  test('a routed page shows a skeleton badge while its route is read, never a blank cell', async () => {
    const wrapper = mountStatus({ route: '/_/routes/x' }, undefined, false)

    expect(wrapper.find('[data-testid="page-status-loading"] .cwa\\:skeleton').attributes('aria-hidden')).toBe('true')
    expect(wrapper.text()).toBe('Loading status')
    expect(await axe(wrapper.element as HTMLElement)).toHaveNoViolations()
  })

  test('a routed page whose route could not be read says its status is unavailable', async () => {
    const wrapper = mountStatus({ route: '/_/routes/x' }, undefined, false, { failed: true })

    expect(wrapper.text()).toBe('Status unavailable')
    expect(await axe(wrapper.element as HTMLElement)).toHaveNoViolations()
  })

  test('a route a parent schedules says it inherits the schedule', () => {
    const route = { liveAt: '2026-11-01T00:00:00Z', _metadata: { effectiveLiveAt: '2999-12-01T00:00:00Z' } }

    expect(status({ route: '/_/routes/x' }, route)).toBe(`Inherited scheduled · ${formatDateTime('2999-12-01T00:00:00Z')}`)
  })

  test('a route under a parent with no go-live date says it inherits not live', () => {
    const route = { liveAt: '2026-11-01T00:00:00Z', _metadata: {} }

    expect(status({ route: '/_/routes/x' }, route)).toBe('Inherited not live')
  })
})
