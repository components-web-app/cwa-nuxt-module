import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import { SAVE_OUTLINE_GAP, SAVE_OUTLINE_SAVED_FOR, toneBehind, useSaveOutline } from './save-outline'
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
