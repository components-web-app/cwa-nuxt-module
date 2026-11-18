export type Axis = 'y' | 'x'

export type Span = { start: number, end: number }

const axes = {
  y: { start: 'top', end: 'bottom', overflow: 'overflowY', client: 'clientHeight', scroll: 'scrollHeight', padStart: 'scrollPaddingTop', padEnd: 'scrollPaddingBottom', viewport: 'innerHeight', border: 'clientTop' },
  x: { start: 'left', end: 'right', overflow: 'overflowX', client: 'clientWidth', scroll: 'scrollWidth', padStart: 'scrollPaddingLeft', padEnd: 'scrollPaddingRight', viewport: 'innerWidth', border: 'clientLeft' },
} as const

function isPage(scroller: Element) {
  return scroller === document.scrollingElement || scroller === document.documentElement || scroller === document.body
}

export function spanOf(el: Element, axis: Axis): Span | undefined {
  const keys = axes[axis]
  if (getComputedStyle(el).display === 'contents') {
    const spans = [...el.children].map(child => spanOf(child, axis)).filter((span): span is Span => !!span)
    return spans.length
      ? { start: Math.min(...spans.map(span => span.start)), end: Math.max(...spans.map(span => span.end)) }
      : undefined
  }
  const rect = el.getBoundingClientRect()
  return rect.width || rect.height ? { start: rect[keys.start], end: rect[keys.end] } : undefined
}

export function scrollerOf(el: Element, axis: Axis): Element {
  const keys = axes[axis]
  for (let node = el.parentElement; node; node = node.parentElement) {
    if (isPage(node)) {
      break
    }
    const overflow = getComputedStyle(node)[keys.overflow]
    if ((overflow === 'auto' || overflow === 'scroll') && node[keys.scroll] > node[keys.client]) {
      return node
    }
  }
  return document.scrollingElement ?? document.documentElement
}

function pixels(value: string) {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function viewOf(scroller: Element, axis: Axis, target: Span, revealed: Element): Span {
  const keys = axes[axis]
  const padding = getComputedStyle(isPage(scroller) ? document.documentElement : scroller)
  const outer = isPage(scroller)
    ? { start: 0, end: window[keys.viewport] }
    : (() => {
        const start = scroller.getBoundingClientRect()[keys.start] + scroller[keys.border]
        return { start, end: start + scroller[keys.client] }
      })()
  let start = outer.start + pixels(padding[keys.padStart])
  let end = outer.end - pixels(padding[keys.padEnd])
  const scope = isPage(scroller) ? document : scroller
  for (const sticky of scope.querySelectorAll('[data-cwa-sticky]')) {
    const span = spanOf(sticky, axis)
    if (!span || revealed.contains(sticky) || scrollerOf(sticky, axis) !== scroller) {
      continue
    }
    const style = getComputedStyle(sticky)
    if (style[keys.start] !== 'auto' && span.start < target.start) {
      start = Math.max(start, outer.start + pixels(style[keys.start]) + span.end - span.start)
    }
    else if (style[keys.end] !== 'auto' && span.end > target.end) {
      end = Math.min(end, outer.end - pixels(style[keys.end]) - (span.end - span.start))
    }
  }
  return { start, end }
}

export function prefersReducedMotion() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function scrollBy(scroller: Element, axis: Axis, delta: number, smooth: boolean) {
  const behavior: ScrollBehavior = smooth ? 'smooth' : 'instant'
  const offset = axis === 'y' ? { top: delta } : { left: delta }
  if (isPage(scroller)) {
    window.scrollBy({ ...offset, behavior })
    return
  }
  scroller.scrollBy({ ...offset, behavior })
}
