import { CwaResourceTypes, getResourceTypeFromIri } from '#cwa/resources/resource-utils'

export interface ResourceStackLevel {
  key: string
  label: string
}

export interface StackPoint {
  x: number
  y: number
}

export interface StackRect {
  left: number
  top: number
  width: number
  height: number
}

export interface StackBoxes {
  panel: { width: number, height: number }
  inner: StackRect
}

const stackTypes: (CwaResourceTypes | undefined)[] = [CwaResourceTypes.COMPONENT, CwaResourceTypes.COMPONENT_POSITION, CwaResourceTypes.COMPONENT_GROUP]

export function resourceStackLevels(stack: { iri: string, displayName?: string }[]): ResourceStackLevel[] {
  const levels: ResourceStackLevel[] = []
  stack.forEach((item, index) => {
    if (stackTypes.includes(getResourceTypeFromIri(item.iri))) {
      levels.push({ key: String(index), label: item.displayName || item.iri })
    }
  })
  return levels
}

function overflow(start: number, size: number, limit: number, margin: number) {
  return Math.max(0, margin - start) + Math.max(0, start + size - (limit - margin))
}

function overlaps(left: number, top: number, panel: StackBoxes['panel'], rect: StackRect, margin: number) {
  return rect.width > 0
    && left + panel.width > rect.left - margin && left < rect.left + rect.width
    && top < rect.top + rect.height && top + panel.height > rect.top
}

export function placeResourceStack(anchor: StackPoint | StackRect, { panel, inner }: StackBoxes, viewport: { width: number, height: number }, avoid?: StackRect, margin = 8) {
  let left: number
  let top: number
  if ('width' in anchor) {
    left = anchor.left - inner.left
    top = anchor.top - inner.top
  }
  else {
    const fromLeft = anchor.x - inner.left
    const fromRight = fromLeft - inner.width
    const fromTop = anchor.y - inner.top
    const fromBottom = fromTop - inner.height
    const overX = (start: number) => overflow(start, panel.width, viewport.width, margin)
    const overY = (start: number) => overflow(start, panel.height, viewport.height, margin)
    left = overX(fromLeft) <= overX(fromRight) ? fromLeft : fromRight
    top = overY(fromTop) <= overY(fromBottom) ? fromTop : fromBottom
  }
  left = Math.min(Math.max(margin, left), viewport.width - panel.width - margin)
  top = Math.min(Math.max(margin, top), viewport.height - panel.height - margin)
  if (avoid && overlaps(left, top, panel, avoid, margin)) {
    if (avoid.left - margin - panel.width >= margin) {
      left = avoid.left - margin - panel.width
    }
    else {
      top = Math.max(margin, Math.min(avoid.top + avoid.height + margin, viewport.height - panel.height - margin))
    }
  }
  return { left, top }
}
