// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { axe } from '../../../../../../test/utils/axe'
import ListState from './ListState.vue'

enableAutoUnmount(afterEach)

function reducedMotion(reduce: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: reduce && query.includes('reduce') }))
}

describe('ListState (#461)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    reducedMotion(false)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  test('loading shows skeleton rows hidden from screen readers, and nothing else for the first 5 seconds', async () => {
    const wrapper = mount(ListState, { props: { state: 'loading', noun: 'pages', rows: 3 } })

    expect(wrapper.findAll('[data-testid="list-state-skeleton"]')).toHaveLength(3)
    expect(wrapper.findAll('[data-testid="list-state-skeleton"]').every(row => row.attributes('aria-hidden') === 'true')).toBe(true)
    expect(wrapper.findAll('.cwa\\:skeleton').length).toBeGreaterThan(0)
    vi.advanceTimersByTime(4999)
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="list-state-progress"]').exists()).toBe(false)
  })

  test('after 5 seconds it says it is still loading', async () => {
    const wrapper = mount(ListState, { props: { state: 'loading', noun: 'pages' } })

    vi.advanceTimersByTime(5000)
    await wrapper.vm.$nextTick()

    expect(wrapper.get('[data-testid="list-state-progress"]').text()).toBe('Still loading…')
  })

  test('with reduced motion a spinner and "Loading pages…" show from the start', async () => {
    reducedMotion(true)
    const wrapper = mount(ListState, { props: { state: 'loading', noun: 'pages' } })
    await wrapper.vm.$nextTick()

    expect(wrapper.get('[data-testid="list-state-progress"]').text()).toBe('Loading pages…')
  })

  test('empty says there is nothing yet, with the action it is given', () => {
    const wrapper = mount(ListState, { props: { state: 'empty', noun: 'pages' }, slots: { default: '<button type="button">Create page</button>' } })

    expect(wrapper.text()).toContain('No pages yet')
    expect(wrapper.get('button').text()).toBe('Create page')
  })

  test('empty takes its own title and description', () => {
    const wrapper = mount(ListState, { props: { state: 'empty', noun: 'pages', title: 'No pages match “x”.', description: 'Try another search.' } })

    expect(wrapper.text()).toContain('No pages match “x”.')
    expect(wrapper.text()).toContain('Try another search.')
    expect(wrapper.text()).not.toContain('No pages yet')
  })

  test.each(['loading', 'empty'] as const)('%s has no axe violations', async (state) => {
    vi.useRealTimers()
    mount(ListState, { props: { state, noun: 'pages' }, attachTo: document.body })

    expect(await axe(document.body)).toHaveNoViolations()
  })
})
