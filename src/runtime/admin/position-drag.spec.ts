// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from 'vitest'
import { createPositionDrag, DRAG_THRESHOLD } from './position-drag'
import type { DragBox, PositionDragState } from './position-drag'

const A = '/_/component_positions/a'
const B = '/_/component_positions/b'
const C = '/_/component_positions/c'

const boxes: Record<string, DragBox> = {
  [A]: { top: 0, bottom: 100, left: 0, right: 400 },
  [B]: { top: 100, bottom: 200, left: 0, right: 400 },
  [C]: { top: 200, bottom: 300, left: 0, right: 400 },
}

function pointer(type: string, init: { x?: number, y?: number, pointerId?: number, button?: number } = {}) {
  return new PointerEvent(type, { bubbles: true, cancelable: true, clientX: init.x ?? 10, clientY: init.y ?? 0, pointerId: init.pointerId ?? 1, button: init.button ?? 0 })
}

function setup(positions = [A, B, C]) {
  const handle = document.createElement('div')
  handle.setPointerCapture = vi.fn()
  handle.releasePointerCapture = vi.fn()
  document.body.appendChild(handle)
  const onReorder = vi.fn()
  const states: Array<PositionDragState | undefined> = []
  const drag = createPositionDrag({
    positions: () => positions,
    boxOf: iri => boxes[iri],
    onReorder,
    onChange: state => states.push(state),
  })
  const press = (iri: string, y: number) => {
    const down = pointer('pointerdown', { y })
    drag.start(down, iri, handle)
    return down
  }
  const outside = document.body.appendChild(document.createElement('div'))
  const moveTo = (y: number, x = 10) => outside.dispatchEvent(pointer('pointermove', { x, y }))
  const release = (y: number) => outside.dispatchEvent(pointer('pointerup', { y }))
  return { handle, drag, onReorder, states, press, moveTo, release }
}

const pageClick = vi.fn()

afterEach(async () => {
  vi.useRealTimers()
  await new Promise(resolve => setTimeout(resolve, 0))
  document.body.innerHTML = ''
  document.removeEventListener('click', pageClick)
  pageClick.mockClear()
})

describe('dragging a position by its component', () => {
  test('dragging the first of three past the third\'s middle reorders it to place 3, once, following the pointer even once it leaves the component', () => {
    const { press, moveTo, release, onReorder } = setup()
    press(A, 50)
    moveTo(200)
    moveTo(260)
    release(260)
    expect(onReorder).toHaveBeenCalledTimes(1)
    expect(onReorder).toHaveBeenCalledWith({ positionIri: A, location: 3 })
  })

  test('dragging the last up past the first\'s middle reorders it to place 1', () => {
    const { press, moveTo, release, onReorder } = setup()
    press(C, 250)
    moveTo(30)
    release(30)
    expect(onReorder).toHaveBeenCalledWith({ positionIri: C, location: 1 })
  })

  test('the pointer is captured only once the press becomes a drag, so a click on a link inside still lands on the link', () => {
    const { press, moveTo, handle } = setup()
    press(A, 50)
    moveTo(50 + DRAG_THRESHOLD - 1)
    expect(handle.setPointerCapture).not.toHaveBeenCalled()
    moveTo(160)
    expect(handle.setPointerCapture).toHaveBeenCalledWith(1)
  })

  test('while dragging, the one drop line sits where the position will land and a ghost of its box follows the pointer, and both clear on release', () => {
    const { press, moveTo, release, states } = setup()
    press(A, 50)
    moveTo(160)
    expect(states.at(-1)).toEqual({ positionIri: A, targetIndex: 1, line: { top: 200, left: 0, right: 400 }, ghost: { top: 110, bottom: 210, left: 0, right: 400 } })
    moveTo(260, 30)
    expect(states.at(-1)).toEqual({ positionIri: A, targetIndex: 2, line: { top: 300, left: 0, right: 400 }, ghost: { top: 210, bottom: 310, left: 20, right: 420 } })
    release(260)
    expect(states.at(-1)).toBeUndefined()
  })

  test('a press that moves less than the threshold is a click: nothing is reordered and the click still reaches the page', () => {
    document.addEventListener('click', pageClick)
    const { press, moveTo, release, onReorder, states, handle } = setup()
    press(A, 50)
    moveTo(50 + DRAG_THRESHOLD - 1)
    release(50 + DRAG_THRESHOLD - 1)
    handle.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(onReorder).not.toHaveBeenCalled()
    expect(states).toEqual([])
    expect(pageClick).toHaveBeenCalledOnce()
  })

  test('the click that ends a drag never reaches the page, so the selection does not change', () => {
    document.addEventListener('click', pageClick)
    const { press, moveTo, release, onReorder } = setup()
    press(A, 50)
    moveTo(260)
    release(260)
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(onReorder).toHaveBeenCalledOnce()
    expect(pageClick).not.toHaveBeenCalled()
  })

  test('only the click ending the drag is swallowed: the next click selects as usual', async () => {
    vi.useFakeTimers()
    document.addEventListener('click', pageClick)
    const { press, moveTo, release } = setup()
    press(A, 50)
    moveTo(260)
    release(260)
    await vi.runAllTimersAsync()
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(pageClick).toHaveBeenCalledOnce()
  })

  test('Escape during a drag cancels it: nothing is reordered and the line clears', () => {
    const { press, moveTo, release, onReorder, states, handle } = setup()
    press(A, 50)
    moveTo(260)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(states.at(-1)).toBeUndefined()
    expect(handle.releasePointerCapture).toHaveBeenCalledWith(1)
    release(260)
    expect(onReorder).not.toHaveBeenCalled()
  })

  test('over its own place there is no drop line, only the ghost, and dropping there reorders nothing', () => {
    const { press, moveTo, release, onReorder, states } = setup()
    press(B, 150)
    moveTo(120)
    expect(states.at(-1)).toEqual({ positionIri: B, targetIndex: 1, line: undefined, ghost: { top: 70, bottom: 170, left: 0, right: 400 } })
    release(120)
    expect(onReorder).not.toHaveBeenCalled()
  })

  test('another pointer\'s moves and release are ignored', () => {
    const { press, moveTo, release, onReorder } = setup()
    press(A, 50)
    moveTo(160)
    window.dispatchEvent(pointer('pointermove', { y: 260, pointerId: 2 }))
    window.dispatchEvent(pointer('pointerup', { y: 260, pointerId: 2 }))
    expect(onReorder).not.toHaveBeenCalled()
    release(160)
    expect(onReorder).toHaveBeenCalledWith({ positionIri: A, location: 2 })
  })

  test('stop() mid-drag removes every listener and the line: later moves and releases do nothing', () => {
    const { press, moveTo, release, onReorder, states, drag } = setup()
    press(A, 50)
    moveTo(260)
    drag.stop()
    expect(states.at(-1)).toBeUndefined()
    const count = states.length
    moveTo(10)
    release(10)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(states.length).toBe(count)
    expect(onReorder).not.toHaveBeenCalled()
  })

  test('the press is left to the page, so a click under the threshold focuses and selects the component as usual', () => {
    const { press } = setup()
    expect(press(A, 50).defaultPrevented).toBe(false)
  })

  test('the browser\'s own drag of a link or image in the component is stopped while it is pressed, and allowed again after', () => {
    const { press, release } = setup()
    press(A, 50)
    const during = new Event('dragstart', { bubbles: true, cancelable: true })
    document.body.dispatchEvent(during)
    release(50)
    const after = new Event('dragstart', { bubbles: true, cancelable: true })
    document.body.dispatchEvent(after)
    expect(during.defaultPrevented).toBe(true)
    expect(after.defaultPrevented).toBe(false)
  })

  test('Escape before the press becomes a drag is left to the page', () => {
    const { press, release, onReorder } = setup()
    press(A, 50)
    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    window.dispatchEvent(escape)
    release(50)
    expect(escape.defaultPrevented).toBe(false)
    expect(onReorder).not.toHaveBeenCalled()
  })

  test('a press with any button but the main one starts nothing, so a right-click still opens the menu', () => {
    const { drag, handle, moveTo, release, states, onReorder } = setup()
    drag.start(pointer('pointerdown', { y: 50, button: 2 }), A, handle)
    moveTo(260)
    release(260)
    expect(states).toEqual([])
    expect(onReorder).not.toHaveBeenCalled()
  })

  test('side-by-side positions: a pointer right of one in the same row is past it', () => {
    const row: Record<string, DragBox> = {
      [A]: { top: 0, bottom: 100, left: 0, right: 100 },
      [B]: { top: 0, bottom: 100, left: 100, right: 200 },
      [C]: { top: 0, bottom: 100, left: 200, right: 300 },
    }
    const handle = document.body.appendChild(document.createElement('div'))
    const onReorder = vi.fn()
    const drag = createPositionDrag({ positions: () => [A, B, C], boxOf: iri => row[iri], onReorder })
    drag.start(pointer('pointerdown', { x: 50, y: 20 }), A, handle)
    handle.dispatchEvent(pointer('pointermove', { x: 260, y: 20 }))
    handle.dispatchEvent(pointer('pointerup', { x: 260, y: 20 }))
    expect(onReorder).toHaveBeenCalledWith({ positionIri: A, location: 3 })
  })
})
