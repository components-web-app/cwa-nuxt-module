// @vitest-environment happy-dom
import { describe, expect, test } from 'vitest'
import { mount } from '@vue/test-utils'
import PageListStatus from './PageListStatus.vue'

const now = new Date('2026-11-18T12:00:00Z')

function status(resource: Record<string, any>, route?: Record<string, any>, known = true) {
  return mount(PageListStatus, { props: { resource: { '@id': '/_/pages/1', ...resource } as any, route: route as any, known, now } }).text()
}

describe('PageListStatus (#461)', () => {
  test('a template says how many pages are built from it, or that none are', () => {
    expect(status({ isTemplate: true, _metadata: { pageDataCount: 14 } })).toBe('Template · 14 pages')
    expect(status({ isTemplate: true, _metadata: { pageDataCount: 1 } })).toBe('Template · 1 page')
    expect(status({ isTemplate: true, _metadata: { pageDataCount: 0 } })).toBe('Template · unused')
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
    expect(status({ route: '/_/routes/x' }, route, false)).toBe('')
    expect(status({ route: '/_/routes/x' }, undefined)).toBe('')
  })

  test('a route held back by a parent says so', () => {
    const route = { liveAt: '2026-11-01T00:00:00Z', _metadata: { effectiveLiveAt: '2026-12-01T00:00:00Z' } }

    expect(status({ route: '/_/routes/x' }, route)).toBe('Held back by parent')
  })
})
