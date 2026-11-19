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

function pointer(type: string, init: { x?: number, y?: number, pointerId?: number } = {}) {
  return new PointerEvent(type, { bubbles: true, cancelable: true, clientX: init.x ?? 10, clientY: init.y ?? 0, pointerId: init.pointerId ?? 1 })
}

function setup(positions = [A, B, C]) {
  const handle = document.createElement('button')
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
  const moveTo = (y: number, x = 10) => handle.dispatchEvent(pointer('pointermove', { x, y }))
  const release = (y: number) => handle.dispatchEvent(pointer('pointerup', { y }))
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

describe('dragging a position by its handle', () => {
  test('dragging the first of three past the third\'s middle reorders it to place 3, once', () => {
    const { press, moveTo, release, onReorder, handle } = setup()
    press(A, 50)
    expect(handle.setPointerCapture).toHaveBeenCalledWith(1)
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

  test('while dragging, the drop line sits where the position will land, and clears on release', () => {
    const { press, moveTo, release, states } = setup()
    press(A, 50)
    moveTo(160)
    expect(states.at(-1)).toEqual({ positionIri: A, targetIndex: 1, line: { top: 200, left: 0, right: 400 } })
    moveTo(260)
    expect(states.at(-1)).toEqual({ positionIri: A, targetIndex: 2, line: { top: 300, left: 0, right: 400 } })
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

  test('dropping where it started reorders nothing', () => {
    const { press, moveTo, release, onReorder, states } = setup()
    press(B, 150)
    moveTo(120)
    expect(states.at(-1)?.targetIndex).toBe(1)
    release(120)
    expect(onReorder).not.toHaveBeenCalled()
  })

  test('another pointer\'s moves and release are ignored', () => {
    const { press, moveTo, release, onReorder, handle } = setup()
    press(A, 50)
    moveTo(160)
    handle.dispatchEvent(pointer('pointermove', { y: 260, pointerId: 2 }))
    handle.dispatchEvent(pointer('pointerup', { y: 260, pointerId: 2 }))
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

  test('the press does not start a text selection or a touch scroll', () => {
    const { press } = setup()
    expect(press(A, 50).defaultPrevented).toBe(true)
  })

  test('side-by-side positions: a pointer right of one in the same row is past it', () => {
    const row: Record<string, DragBox> = {
      [A]: { top: 0, bottom: 100, left: 0, right: 100 },
      [B]: { top: 0, bottom: 100, left: 100, right: 200 },
      [C]: { top: 0, bottom: 100, left: 200, right: 300 },
    }
    const handle = document.createElement('button')
    const onReorder = vi.fn()
    const drag = createPositionDrag({ positions: () => [A, B, C], boxOf: iri => row[iri], onReorder })
    drag.start(pointer('pointerdown', { x: 50, y: 20 }), A, handle)
    handle.dispatchEvent(pointer('pointermove', { x: 260, y: 20 }))
    handle.dispatchEvent(pointer('pointerup', { x: 260, y: 20 }))
    expect(onReorder).toHaveBeenCalledWith({ positionIri: A, location: 3 })
  })
})
