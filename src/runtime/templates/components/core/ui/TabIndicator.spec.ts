// @vitest-environment happy-dom
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h, reactive } from 'vue'
import { axe } from '../../../../../../test/utils/axe'
import TabIndicator from './TabIndicator.vue'
import type { TabBox } from './TabIndicator.vue'

enableAutoUnmount(afterEach)

const resizeCallbacks: (() => void)[] = []
const observed: Element[] = []

class FakeResizeObserver {
  constructor(private callback: () => void) {
    resizeCallbacks.push(callback)
  }

  observe(element: Element) {
    observed.push(element)
  }

  unobserve() {}

  disconnect() {}
}

beforeEach(() => {
  resizeCallbacks.length = 0
  observed.length = 0
  vi.stubGlobal('ResizeObserver', FakeResizeObserver)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function strip(boxes: Record<string, TabBox>, initial = 'a') {
  const state = reactive({ selected: initial, tabs: ['a', 'b', 'c'], badge: false })
  const measure = vi.fn((tab: HTMLElement) => boxes[tab.id]!)
  const Strip = defineComponent({
    setup() {
      return () => h('div', { 'role': 'tablist', 'aria-label': 'Sections' }, [
        ...state.tabs.map(key => h('button', { 'key': key, 'id': key, 'type': 'button', 'role': 'tab', 'aria-selected': state.selected === key ? 'true' : 'false', 'aria-controls': 'panel' }, [key, state.badge && key === 'a' ? h('span', '!') : null])),
        h(TabIndicator, { measure }),
      ])
    },
  })
  const wrapper = mount(Strip, { attachTo: document.body })
  const indicator = () => wrapper.get('[data-testid="tab-indicator"]')
  return { wrapper, state, measure, indicator }
}

const boxes = { a: { left: 8, width: 60 }, b: { left: 68, width: 90 }, c: { left: 158, width: 40 } }

function slides(element: Element) {
  return element.classList.contains('cwa:transition-[translate,width]')
}

describe('TabIndicator', () => {
  test('one bar is drawn at the selected tab\'s offset and width, jumping there on first render', async () => {
    const { indicator, measure, wrapper } = strip(boxes)
    await flushPromises()

    expect(wrapper.findAll('[data-testid="tab-indicator"]')).toHaveLength(1)
    expect(measure).toHaveBeenCalledWith(wrapper.get('#a').element)
    expect(indicator().attributes('style')).toContain('translate: 8px 0')
    expect(indicator().attributes('style')).toContain('width: 60px')
    expect(slides(indicator().element)).toBe(false)
    expect(indicator().attributes('aria-hidden')).toBe('true')
  })

  test('changing the selected tab slides the bar to it over the indicator duration', async () => {
    const { indicator, state } = strip(boxes)
    await flushPromises()

    state.selected = 'b'
    await flushPromises()

    expect(indicator().attributes('style')).toContain('translate: 68px 0')
    expect(indicator().attributes('style')).toContain('width: 90px')
    expect(slides(indicator().element)).toBe(true)
    expect(indicator().classes()).toEqual(expect.arrayContaining(['cwa:duration-(--cwa-duration-indicator)', 'cwa:ease-(--cwa-ease-out)']))
  })

  test('a resize of the strip moves the bar to the new measurement without sliding, even straight after a slide', async () => {
    const box = { ...boxes }
    const { indicator, state } = strip(box)
    await flushPromises()
    state.selected = 'b'
    await flushPromises()

    box.b = { left: 50, width: 70 }
    resizeCallbacks.forEach(callback => callback())
    await flushPromises()

    expect(indicator().attributes('style')).toContain('translate: 50px 0')
    expect(indicator().attributes('style')).toContain('width: 70px')
    expect(slides(indicator().element)).toBe(false)
  })

  test('a resize that leaves the bar where it is does not cut short a slide in progress', async () => {
    const { indicator, state } = strip(boxes)
    await flushPromises()
    state.selected = 'b'
    await flushPromises()

    resizeCallbacks.forEach(callback => callback())
    await flushPromises()

    expect(slides(indicator().element)).toBe(true)
  })

  test('a badge that widens the selected tab re-measures it without sliding', async () => {
    const box = { ...boxes }
    const { indicator, state } = strip(box)
    await flushPromises()

    box.a = { left: 8, width: 76 }
    state.badge = true
    await flushPromises()

    expect(indicator().attributes('style')).toContain('width: 76px')
    expect(slides(indicator().element)).toBe(false)
  })

  test('a selected tab in a new set of tabs, the old selected tab gone, is jumped to, not slid to', async () => {
    const box: Record<string, TabBox> = { ...boxes, d: { left: 8, width: 120 }, e: { left: 128, width: 50 } }
    const { indicator, state } = strip(box)
    await flushPromises()

    state.tabs = ['d', 'e']
    state.selected = 'e'
    await flushPromises()

    expect(indicator().attributes('style')).toContain('translate: 128px 0')
    expect(slides(indicator().element)).toBe(false)
  })

  test('the strip and every tab, including one added later, are observed for size', async () => {
    const { state, wrapper } = strip(boxes)
    await flushPromises()
    state.tabs = ['a', 'b', 'c', 'd']
    await flushPromises()

    const tablist = wrapper.get('[role="tablist"]').element
    expect(observed).toEqual(expect.arrayContaining([tablist, ...tablist.querySelectorAll('[role="tab"]')]))
  })

  test('reduced motion turns the slide\'s transition off, and the compiled CSS does so under prefers-reduced-motion', async () => {
    const { indicator, state } = strip(boxes)
    await flushPromises()
    state.selected = 'c'
    await flushPromises()

    expect(indicator().classes()).toContain('cwa:motion-reduce:transition-none')
    const css = readFileSync(resolve(import.meta.dirname, '../../../assets/cwa.css'), 'utf8')
    const reduced = /@media \(prefers-reduced-motion: reduce\) \{[^@]*\.cwa\\:motion-reduce\\:transition-none \{\n\s*transition-property: none;/.exec(css)
    expect(reduced).not.toBeNull()
    expect(reduced!.index).toBeGreaterThan(css.indexOf('.cwa\\:transition-\\[translate\\,width\\] {'))
    expect(css.indexOf('.cwa\\:transition-\\[translate\\,width\\] {')).toBeGreaterThan(-1)
    expect(css).toMatch(/--cwa-duration-indicator: 250ms;/)
  })

  test('nothing is drawn while no tab is selected, and the bar then jumps to the next selected tab', async () => {
    const { indicator, state } = strip(boxes)
    await flushPromises()
    state.selected = 'none'
    await flushPromises()

    expect(indicator().isVisible()).toBe(false)

    state.selected = 'b'
    await flushPromises()

    expect(indicator().isVisible()).toBe(true)
    expect(indicator().attributes('style')).toContain('translate: 68px 0')
    expect(slides(indicator().element)).toBe(false)
  })

  test('has no axe violations inside a tablist', async () => {
    const panel = document.createElement('div')
    panel.id = 'panel'
    panel.setAttribute('role', 'tabpanel')
    document.body.appendChild(panel)
    const { wrapper } = strip(boxes)
    await flushPromises()

    expect(await axe(wrapper.element as HTMLElement)).toHaveNoViolations()
    panel.remove()
  })
})
