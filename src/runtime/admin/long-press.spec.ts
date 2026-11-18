// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { listenForLongPress, LONG_PRESS_MS } from './long-press'

function pointer(type: string, target: EventTarget, init: { x?: number, y?: number, pointerType?: string, pointerId?: number } = {}) {
  const event = new MouseEvent(type, { clientX: init.x ?? 100, clientY: init.y ?? 200, bubbles: true, cancelable: true }) as MouseEvent & { pointerType: string, pointerId: number }
  Object.defineProperty(event, 'pointerType', { value: init.pointerType ?? 'touch' })
  Object.defineProperty(event, 'pointerId', { value: init.pointerId ?? 1 })
  target.dispatchEvent(event)
  return event
}

let target: HTMLElement
let contextMenus: MouseEvent[]
let stop: () => void

beforeEach(() => {
  vi.useFakeTimers()
  target = document.createElement('p')
  target.textContent = 'Our kitchens'
  document.body.append(target)
  contextMenus = []
  target.addEventListener('contextmenu', event => contextMenus.push(event))
  stop = listenForLongPress(document)
})

afterEach(() => {
  stop()
  target.remove()
  vi.useRealTimers()
})

describe('listenForLongPress (#461)', () => {
  test('holding a touch still for 500 ms sends a contextmenu event at the touched element and point, which bubbles like a right-click', () => {
    pointer('pointerdown', target, { x: 120, y: 240 })
    vi.advanceTimersByTime(LONG_PRESS_MS - 1)
    expect(contextMenus).toHaveLength(0)
    vi.advanceTimersByTime(1)

    expect(LONG_PRESS_MS).toBe(500)
    expect(contextMenus).toHaveLength(1)
    expect(contextMenus[0]!.clientX).toBe(120)
    expect(contextMenus[0]!.clientY).toBe(240)
    expect(contextMenus[0]!.bubbles).toBe(true)
    expect(contextMenus[0]!.cancelable).toBe(true)
  })

  test('moving more than 8px cancels it, and 8px or less does not', () => {
    pointer('pointerdown', target, { x: 100, y: 100 })
    pointer('pointermove', target, { x: 106, y: 105 })
    vi.advanceTimersByTime(LONG_PRESS_MS)
    expect(contextMenus).toHaveLength(1)

    pointer('pointerup', target)
    pointer('pointerdown', target, { x: 100, y: 100 })
    pointer('pointermove', target, { x: 107, y: 106 })
    vi.advanceTimersByTime(LONG_PRESS_MS)
    expect(contextMenus).toHaveLength(1)
  })

  test('lifting or cancelling the touch before 500 ms cancels it', () => {
    pointer('pointerdown', target)
    vi.advanceTimersByTime(300)
    pointer('pointerup', target)
    vi.advanceTimersByTime(LONG_PRESS_MS)
    pointer('pointerdown', target)
    pointer('pointercancel', target)
    vi.advanceTimersByTime(LONG_PRESS_MS)

    expect(contextMenus).toHaveLength(0)
  })

  test('a mouse or pen is left to its own right-click', () => {
    pointer('pointerdown', target, { pointerType: 'mouse' })
    vi.advanceTimersByTime(LONG_PRESS_MS)
    pointer('pointerup', target, { pointerType: 'mouse' })
    pointer('pointerdown', target, { pointerType: 'pen' })
    vi.advanceTimersByTime(LONG_PRESS_MS)

    expect(contextMenus).toHaveLength(0)
  })

  test('inside text being edited the long press is left to the browser\'s text selection', () => {
    const input = document.createElement('input')
    const editor = document.createElement('div')
    editor.contentEditable = 'true'
    const inEditor = document.createElement('strong')
    editor.append(inEditor)
    document.body.append(input, editor)
    const seen: EventTarget[] = []
    document.addEventListener('contextmenu', event => seen.push(event.target!))

    for (const element of [input, inEditor]) {
      pointer('pointerdown', element)
      vi.advanceTimersByTime(LONG_PRESS_MS)
      pointer('pointerup', element)
    }

    expect(seen).toEqual([])
    input.remove()
    editor.remove()
  })

  test('the browser\'s own contextmenu and the click that end the same press are swallowed, so they never close or reselect', () => {
    const clicks = vi.fn()
    const natives = vi.fn()
    target.addEventListener('click', clicks)
    pointer('pointerdown', target)
    vi.advanceTimersByTime(LONG_PRESS_MS)
    target.addEventListener('contextmenu', natives)
    const native = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
    target.dispatchEvent(native)
    pointer('pointerup', target)
    const click = new MouseEvent('click', { bubbles: true, cancelable: true })
    target.dispatchEvent(click)

    expect(natives).not.toHaveBeenCalled()
    expect(native.defaultPrevented).toBe(true)
    expect(clicks).not.toHaveBeenCalled()
    expect(click.defaultPrevented).toBe(true)

    vi.advanceTimersByTime(1000)
    target.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(clicks).toHaveBeenCalledTimes(1)
  })

  test('a held touch\'s own contextmenu is swallowed before 500 ms too, so the menu opens once, at 500 ms', () => {
    pointer('pointerdown', target)
    vi.advanceTimersByTime(400)
    const native = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
    target.dispatchEvent(native)
    expect(native.defaultPrevented).toBe(true)
    expect(contextMenus).toHaveLength(0)
    vi.advanceTimersByTime(100)

    expect(contextMenus).toHaveLength(1)
  })

  test('listening twice on the same root opens one menu per press, and listens until both have stopped', () => {
    const second = listenForLongPress(document)
    pointer('pointerdown', target)
    vi.advanceTimersByTime(LONG_PRESS_MS)
    pointer('pointerup', target)
    vi.advanceTimersByTime(1000)
    expect(contextMenus).toHaveLength(1)

    second()
    second()
    pointer('pointerdown', target)
    vi.advanceTimersByTime(LONG_PRESS_MS)
    expect(contextMenus).toHaveLength(2)
  })

  test('stopping removes every listener', () => {
    stop()
    pointer('pointerdown', target)
    vi.advanceTimersByTime(LONG_PRESS_MS)

    expect(contextMenus).toHaveLength(0)
    stop = () => {}
  })
})
