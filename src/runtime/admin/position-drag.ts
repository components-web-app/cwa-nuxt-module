import type { ReorderEvent } from './admin'

export interface DragBox {
  top: number
  bottom: number
  left: number
  right: number
}

export interface PositionDragState {
  positionIri: string
  targetIndex: number
  line: { top: number, left: number, right: number }
}

export interface PositionDragOptions {
  positions: () => string[]
  boxOf: (positionIri: string) => DragBox | undefined
  onReorder: (event: ReorderEvent) => void
  onChange?: (state: PositionDragState | undefined) => void
}

export const DRAG_THRESHOLD = 4

function overlapsRow(box: DragBox, other: DragBox) {
  const overlap = Math.min(box.bottom, other.bottom) - Math.max(box.top, other.top)
  return overlap > Math.min(box.bottom - box.top, other.bottom - other.top) / 2
}

function isPast(box: DragBox, inRow: boolean, x: number, y: number) {
  if (!inRow) {
    return y > (box.top + box.bottom) / 2
  }
  return y > box.bottom || (y >= box.top && x > (box.left + box.right) / 2)
}

export function dropTarget(order: string[], positionIri: string, boxOf: PositionDragOptions['boxOf'], x: number, y: number) {
  const others = order.filter(iri => iri !== positionIri)
  const boxes = others.map(iri => boxOf(iri))
  let targetIndex = 0
  boxes.forEach((box, index) => {
    if (!box) {
      return
    }
    const inRow = boxes.some((other, otherIndex) => otherIndex !== index && !!other && overlapsRow(box, other))
    if (isPast(box, inRow, x, y)) {
      targetIndex = index + 1
    }
  })
  const before = boxes[targetIndex]
  const after = boxes[targetIndex - 1]
  const anchor = before ?? after
  const line = anchor ? { top: before ? before.top : anchor.bottom, left: anchor.left, right: anchor.right } : undefined
  return { targetIndex, line }
}

function attempt(action: () => void) {
  try {
    action()
  }
  catch {
    return
  }
}

export function createPositionDrag(options: PositionDragOptions) {
  let end: ((commit: boolean) => void) | undefined

  function start(down: PointerEvent, positionIri: string, handle: HTMLElement) {
    end?.(false)
    down.preventDefault()
    const pointerId = down.pointerId
    const from = options.positions().indexOf(positionIri)
    if (from === -1) {
      return
    }
    attempt(() => handle.setPointerCapture?.(pointerId))
    let dragging = false
    let state: PositionDragState | undefined

    const move = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) {
        return
      }
      if (!dragging && Math.max(Math.abs(event.clientX - down.clientX), Math.abs(event.clientY - down.clientY)) < DRAG_THRESHOLD) {
        return
      }
      dragging = true
      const { targetIndex, line } = dropTarget(options.positions(), positionIri, options.boxOf, event.clientX, event.clientY)
      state = line ? { positionIri, targetIndex, line } : undefined
      options.onChange?.(state)
    }
    const up = (event: PointerEvent) => {
      if (event.pointerId === pointerId) {
        finish(true)
      }
    }
    const cancel = (event: PointerEvent) => {
      if (event.pointerId === pointerId) {
        finish(false)
      }
    }
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        finish(false)
      }
    }

    function finish(commit: boolean) {
      end = undefined
      handle.removeEventListener('pointermove', move)
      handle.removeEventListener('pointerup', up)
      handle.removeEventListener('pointercancel', cancel)
      window.removeEventListener('keydown', keydown, true)
      attempt(() => handle.releasePointerCapture?.(pointerId))
      if (!dragging) {
        return
      }
      swallowNextClick()
      state && options.onChange?.(undefined)
      if (commit && state && state.targetIndex !== from) {
        options.onReorder({ positionIri, location: state.targetIndex + 1 })
      }
    }

    handle.addEventListener('pointermove', move)
    handle.addEventListener('pointerup', up)
    handle.addEventListener('pointercancel', cancel)
    window.addEventListener('keydown', keydown, true)
    end = finish
  }

  function stop() {
    end?.(false)
  }

  return { start, stop }
}

function swallowNextClick() {
  const swallow = (event: MouseEvent) => {
    event.preventDefault()
    event.stopImmediatePropagation()
    window.removeEventListener('click', swallow, true)
  }
  window.addEventListener('click', swallow, true)
  setTimeout(() => window.removeEventListener('click', swallow, true), 0)
}
