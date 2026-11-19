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
  line: { top: number, left: number, right: number } | undefined
  ghost: DragBox | undefined
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

  function start(down: PointerEvent, positionIri: string, element: HTMLElement) {
    end?.(false)
    if (down.button !== 0) {
      return
    }
    const pointerId = down.pointerId
    const from = options.positions().indexOf(positionIri)
    if (from === -1) {
      return
    }
    const startBox = options.boxOf(positionIri)
    let dragging = false
    let state: PositionDragState | undefined

    const move = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) {
        return
      }
      const dx = event.clientX - down.clientX
      const dy = event.clientY - down.clientY
      if (!dragging && Math.max(Math.abs(dx), Math.abs(dy)) < DRAG_THRESHOLD) {
        return
      }
      if (!dragging) {
        dragging = true
        attempt(() => element.setPointerCapture?.(pointerId))
      }
      const { targetIndex, line } = dropTarget(options.positions(), positionIri, options.boxOf, event.clientX, event.clientY)
      const ghost = startBox && { top: startBox.top + dy, bottom: startBox.bottom + dy, left: startBox.left + dx, right: startBox.right + dx }
      state = { positionIri, targetIndex, line: targetIndex === from ? undefined : line, ghost }
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
      if (dragging && event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        finish(false)
      }
    }
    const nativeDrag = (event: Event) => event.preventDefault()

    function finish(commit: boolean) {
      end = undefined
      window.removeEventListener('pointermove', move, true)
      window.removeEventListener('pointerup', up, true)
      window.removeEventListener('pointercancel', cancel, true)
      window.removeEventListener('keydown', keydown, true)
      window.removeEventListener('dragstart', nativeDrag, true)
      if (!dragging) {
        return
      }
      attempt(() => element.releasePointerCapture?.(pointerId))
      swallowNextClick()
      options.onChange?.(undefined)
      if (commit && state && state.targetIndex !== from) {
        options.onReorder({ positionIri, location: state.targetIndex + 1 })
      }
    }

    window.addEventListener('pointermove', move, true)
    window.addEventListener('pointerup', up, true)
    window.addEventListener('pointercancel', cancel, true)
    window.addEventListener('keydown', keydown, true)
    window.addEventListener('dragstart', nativeDrag, true)
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
