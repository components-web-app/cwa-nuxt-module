import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { FOCUS_CUTOUT_OFFSET, FOCUS_CUTOUT_RADIUS, SAVE_OUTLINE_GAP, SAVE_OUTLINE_GLOW_FADE, SAVE_OUTLINE_INSET, SAVE_OUTLINE_SAVED_FOR, focusRadiusAt, saveOutlineStyle, toneBehind, useSaveOutline } from './save-outline'
import type { CwaFieldState } from '../storage/stores/resources/state'

function state(status: CwaFieldState['status']): CwaFieldState {
  return { status, waiting: false, slow: false }
}

function setup(initial: CwaFieldState[] = []) {
  const states = ref<CwaFieldState[]>(initial)
  const selection = ref('/component/a')
  const scope = effectScope()
  const phase = scope.run(() => useSaveOutline(states, selection))!
  return { states, selection, phase, scope }
}

describe('useSaveOutline', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test('shows nothing while a change only waits for its debounce', () => {
    const { phase } = setup([state('pending')])
    expect(phase.value).toBe('rest')
  })

  test('sweeps from the first send, and turns to saved once nothing is in flight, then back to the selection colour', async () => {
    const { states, phase } = setup()
    states.value = [state('saving')]
    await nextTick()
    expect(phase.value).toBe('saving')
    states.value = [state('saved')]
    await nextTick()
    expect(phase.value).toBe('saving')
    vi.advanceTimersByTime(SAVE_OUTLINE_GAP)
    expect(phase.value).toBe('saved')
    vi.advanceTimersByTime(SAVE_OUTLINE_SAVED_FOR)
    expect(phase.value).toBe('rest')
  })

  test('a follow-up sent within the gap keeps one sweep going instead of restarting it', async () => {
    const { states, phase } = setup()
    states.value = [state('saving')]
    await nextTick()
    states.value = [state('saved')]
    await nextTick()
    vi.advanceTimersByTime(SAVE_OUTLINE_GAP - 50)
    states.value = [state('saving')]
    await nextTick()
    vi.advanceTimersByTime(SAVE_OUTLINE_GAP)
    expect(phase.value).toBe('saving')
  })

  test('ends in a held error or conflict that stays until the field leaves it', async () => {
    const { states, phase } = setup()
    states.value = [state('saving'), state('saved')]
    await nextTick()
    states.value = [state('error'), state('saved')]
    await nextTick()
    vi.advanceTimersByTime(SAVE_OUTLINE_GAP + SAVE_OUTLINE_SAVED_FOR)
    expect(phase.value).toBe('error')
    states.value = [state('error'), state('conflict')]
    expect(phase.value).toBe('conflict')
    states.value = [state('saved'), state('saved')]
    expect(phase.value).toBe('rest')
  })

  test('a new selection drops the previous one\'s saved state', async () => {
    const { states, selection, phase } = setup()
    states.value = [state('saving')]
    await nextTick()
    states.value = [state('saved')]
    await nextTick()
    vi.advanceTimersByTime(SAVE_OUTLINE_GAP)
    expect(phase.value).toBe('saved')
    selection.value = '/component/b'
    states.value = []
    await nextTick()
    expect(phase.value).toBe('rest')
  })

  test('stops its timers when its scope ends', async () => {
    const { states, scope } = setup()
    states.value = [state('saving')]
    await nextTick()
    states.value = [state('saved')]
    await nextTick()
    scope.stop()
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('toneBehind', () => {
  function chain(...colours: string[]) {
    const elements = colours.map(() => document.createElement('div'))
    elements.reduce((child, parent) => {
      parent.appendChild(child)
      return parent
    })
    const backgrounds = new Map(elements.map((element, index) => [element as Element, colours[index]!]))
    return { first: elements[0]!, read: (element: Element) => backgrounds.get(element) ?? 'rgba(0, 0, 0, 0)' }
  }

  test('reads the first painted background from the selection outwards: a dark site gets the dark set', () => {
    const { first, read } = chain('rgba(0, 0, 0, 0)', 'rgb(27, 46, 39)', 'rgb(255, 255, 255)')
    expect(toneBehind(first, read)).toBe('dark')
  })

  test('a light site gets the light set', () => {
    const { first, read } = chain('rgba(0, 0, 0, 0)', 'rgb(255, 253, 249)')
    expect(toneBehind(first, read)).toBe('light')
  })

  test('with nothing painted, the page is taken as light', () => {
    const { first, read } = chain('rgba(0, 0, 0, 0)')
    expect(toneBehind(first, read)).toBe('light')
  })
})

describe('the save outline\'s shape', () => {
  test('every edge drawn around the selection curves about the same centre as the dimmed cutout, so the save ring matches the highlight\'s rounding', () => {
    expect(focusRadiusAt(FOCUS_CUTOUT_OFFSET)).toBe(FOCUS_CUTOUT_RADIUS)
    for (const outset of [0, SAVE_OUTLINE_INSET, FOCUS_CUTOUT_OFFSET]) {
      expect(outset - focusRadiusAt(outset)).toBe(FOCUS_CUTOUT_OFFSET - FOCUS_CUTOUT_RADIUS)
    }
    expect(saveOutlineStyle).toMatchObject({ 'inset': `-${SAVE_OUTLINE_INSET}px`, '--save-radius': `${focusRadiusAt(SAVE_OUTLINE_INSET)}px` })
  })

  test('the saved state lasts exactly as long as its glow takes to fade slowly in and back out', () => {
    expect(SAVE_OUTLINE_GLOW_FADE).toBeGreaterThanOrEqual(600)
    expect(SAVE_OUTLINE_GLOW_FADE).toBeLessThanOrEqual(900)
    expect(SAVE_OUTLINE_SAVED_FOR).toBe(SAVE_OUTLINE_GLOW_FADE * 2)
    expect(saveOutlineStyle).toMatchObject({ '--save-for': `${SAVE_OUTLINE_SAVED_FOR}ms` })
  })
})

describe('the save outline\'s compiled CSS', () => {
  const css = readFileSync(resolve(import.meta.dirname, '../templates/assets/cwa.css'), 'utf8')

  function rule(selector: string) {
    const start = css.indexOf(`${selector} {`)
    return start === -1 ? '' : css.slice(start, css.indexOf('}', start))
  }

  function keyframes(name: string) {
    const start = css.indexOf(`@keyframes ${name} {`)
    return start === -1 ? '' : css.slice(start, css.indexOf('\n}', start))
  }

  test('the ring and its glow are rounded by the radius the component hands them, and the sweep is clipped to that rounded ring', () => {
    expect(rule('.cwa\\:focus-save')).toMatch(/border-radius: var\(--save-radius\)/)
    expect(rule('.cwa\\:focus-save::before')).toMatch(/border-radius: inherit/)
    const ring = rule('.cwa\\:focus-save-ring')
    expect(ring).toMatch(/border-radius: inherit/)
    expect(ring).toMatch(/mask-composite: exclude/)
    expect(rule('.cwa\\:focus-save-ring > i[data-side=\'top\']')).toMatch(/height: max\(var\(--save-radius\), 2px\)/)
  })

  test('the glow is subtle, and fades in and out over the whole saved time instead of appearing at once', () => {
    const glow = rule('.cwa\\:focus-save::before')
    expect(glow).toMatch(/opacity: 0;/)
    expect(glow).toMatch(/box-shadow: 0 0 4px 0 var\(--save-end\)/)
    expect(rule('.cwa\\:focus-save[data-save=\'saved\']::before')).toMatch(/animation: cwa-focus-glow var\(--save-for\) ease-in-out/)
    const frames = keyframes('cwa-focus-glow')
    expect(frames).toMatch(/0%, 100% \{\s*opacity: 0;/)
    const peak = Number(frames.match(/50% \{\s*opacity: ([\d.]+);/)?.[1])
    expect(peak).toBeGreaterThan(0)
    expect(peak).toBeLessThanOrEqual(0.5)
  })

  test('the saved line holds and fades over the same time as its glow', () => {
    expect(rule('.cwa\\:focus-save[data-save=\'saved\']')).toMatch(/animation: cwa-line-hold var\(--save-for\) ease-out forwards/)
  })

  test('with reduced motion the sweep and the glow are off, leaving colour only', () => {
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\.cwa\\:focus-save-ring > i \{\s*background-image: none !important;\s*animation: none !important;\s*\}\s*\.cwa\\:focus-save::before \{\s*animation: none !important;/)
  })
})
