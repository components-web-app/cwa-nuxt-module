// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import Reveal from './Reveal.vue'
import { revealDelta } from './reveal'
import type { Span } from './reveal-geometry'

const geometry = vi.hoisted(() => ({
  spans: new Map<string, Span>(),
  view: { start: 0, end: 600 },
  reduced: false,
  scroller: {} as Element,
}))

vi.mock('./reveal-geometry', () => ({
  spanOf: vi.fn((el: Element, axis: string) => axis === 'y' ? geometry.spans.get((el as HTMLElement).dataset.geometry ?? (el.firstElementChild as HTMLElement | null)?.dataset.geometry ?? '') : undefined),
  scrollerOf: vi.fn(() => geometry.scroller),
  viewOf: vi.fn(() => geometry.view),
  prefersReducedMotion: vi.fn(() => geometry.reduced),
  scrollBy: vi.fn(),
}))

const { scrollBy, viewOf } = await import('./reveal-geometry')

let now = 0
beforeEach(() => {
  now = 10_000
  vi.spyOn(performance, 'now').mockImplementation(() => now)
})

afterEach(() => {
  geometry.spans.clear()
  geometry.view = { start: 0, end: 600 }
  geometry.reduced = false
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

function harness(initial = false, keep = false) {
  const shown = ref(initial)
  const wrapper = mount(defineComponent({
    setup: () => () => h('div', [
      h('button', { 'data-geometry': 'control' }, 'Nested under'),
      h(Reveal, { when: shown.value, keep }, () => h('div', { 'data-geometry': 'revealed' }, 'Parent page')),
    ]),
  }), { attachTo: document.body })
  return { wrapper, shown }
}

function userActs() {
  now += 5
  document.dispatchEvent(new Event('pointerdown'))
  now += 5
}

async function reveal(shown: { value: boolean }) {
  shown.value = true
  await nextTick()
  await nextTick()
}

describe('revealDelta', () => {
  const view = { start: 100, end: 500 }

  test('content already fully in view moves nothing', () => {
    expect(revealDelta(view, { start: 200, end: 480 })).toBe(0)
  })

  test('content below the fold scrolls just enough to show its bottom', () => {
    expect(revealDelta(view, { start: 450, end: 560 })).toBe(60)
  })

  test('content above the view scrolls just enough to show its top', () => {
    expect(revealDelta(view, { start: 60, end: 200 })).toBe(-40)
  })

  test('content taller than the view aligns its top', () => {
    expect(revealDelta(view, { start: 450, end: 1000 })).toBe(350)
  })

  test('content taller than the view keeps the control that revealed it in view when it can', () => {
    expect(revealDelta(view, { start: 450, end: 1000 }, { start: 410, end: 440 })).toBe(310)
    expect(revealDelta(view, { start: 450, end: 1000 }, { start: -400, end: -370 })).toBe(350)
  })
})

describe('Reveal (#461)', () => {
  test('content revealed below the fold by a user\'s choice scrolls its container by the least movement', async () => {
    geometry.spans.set('revealed', { start: 560, end: 640 })
    const { shown } = harness()
    userActs()
    await reveal(shown)

    expect(scrollBy).toHaveBeenCalledWith(geometry.scroller, 'y', 40, true)
  })

  test('content revealed already in view moves nothing', async () => {
    geometry.spans.set('revealed', { start: 300, end: 380 })
    const { shown } = harness()
    userActs()
    await reveal(shown)

    expect(viewOf).toHaveBeenCalled()
    expect(scrollBy).not.toHaveBeenCalled()
  })

  test('content shown on mount never scrolls, even when the click that opened the dialog was a moment ago', async () => {
    geometry.spans.set('revealed', { start: 560, end: 640 })
    userActs()
    harness(true)
    await nextTick()
    await nextTick()

    expect(scrollBy).not.toHaveBeenCalled()
  })

  test('content that appears as the dialog loads, after the click that opened it, never scrolls', async () => {
    geometry.spans.set('revealed', { start: 560, end: 640 })
    userActs()
    const { shown } = harness()
    now += 20
    await reveal(shown)

    expect(scrollBy).not.toHaveBeenCalled()
  })

  test('content shown without a user action, as when data loads, never scrolls', async () => {
    geometry.spans.set('revealed', { start: 560, end: 640 })
    const { shown } = harness()
    userActs()
    now += 5000
    await reveal(shown)

    expect(scrollBy).not.toHaveBeenCalled()
  })

  test('a re-render while shown never scrolls again', async () => {
    geometry.spans.set('revealed', { start: 560, end: 640 })
    const { wrapper, shown } = harness()
    userActs()
    await reveal(shown)
    vi.mocked(scrollBy).mockClear()

    userActs()
    wrapper.vm.$forceUpdate()
    await nextTick()
    expect(scrollBy).not.toHaveBeenCalled()
  })

  test('with keep, hidden content stays mounted, so a hidden field stays registered, and showing it still reveals it', async () => {
    geometry.spans.set('revealed', { start: 560, end: 640 })
    const { wrapper, shown } = harness(false, true)
    const content = wrapper.find('[data-geometry="revealed"]')
    expect(content.exists()).toBe(true)
    expect(content.isVisible()).toBe(false)

    userActs()
    await reveal(shown)
    expect(wrapper.find('[data-geometry="revealed"]').isVisible()).toBe(true)
    expect(scrollBy).toHaveBeenCalledWith(geometry.scroller, 'y', 40, true)
  })

  test('with reduced motion the scroll is instant', async () => {
    geometry.spans.set('revealed', { start: 560, end: 640 })
    geometry.reduced = true
    const { shown } = harness()
    userActs()
    await reveal(shown)

    expect(scrollBy).toHaveBeenCalledWith(geometry.scroller, 'y', 40, false)
  })

  test('focus stays on the control that revealed the content', async () => {
    geometry.spans.set('revealed', { start: 560, end: 640 })
    const { wrapper, shown } = harness()
    const control = wrapper.find('button').element as HTMLButtonElement
    control.focus()
    userActs()
    await reveal(shown)

    expect(scrollBy).toHaveBeenCalled()
    expect(document.activeElement).toBe(control)
  })
})
