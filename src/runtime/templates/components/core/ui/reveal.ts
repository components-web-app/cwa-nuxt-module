import { nextTick, onMounted, watch } from 'vue'
import { prefersReducedMotion, scrollBy, scrollerOf, spanOf, viewOf } from './reveal-geometry'
import type { Axis, Span } from './reveal-geometry'

const USER_ACTION_WINDOW = 1000

export function revealDelta(view: Span, target: Span, control?: Span): number {
  if (target.start >= view.start && target.end <= view.end) {
    return 0
  }
  const size = view.end - view.start
  if (target.end - target.start > size) {
    if (control && control.start <= target.start && target.start - control.start < size) {
      return control.start - view.start
    }
    return target.start - view.start
  }
  if (target.end > view.end) {
    return target.end - view.end
  }
  return target.start - view.start
}

export function revealElement(el: Element, control: Element | null) {
  const smooth = !prefersReducedMotion()
  for (const axis of ['y', 'x'] as Axis[]) {
    const target = spanOf(el, axis)
    if (!target) {
      continue
    }
    const scroller = scrollerOf(el, axis)
    const view = viewOf(scroller, axis, target, el)
    const controlSpan = control && scrollerOf(control, axis) === scroller ? spanOf(control, axis) : undefined
    const delta = revealDelta(view, target, controlSpan)
    if (delta) {
      scrollBy(scroller, axis, delta, smooth)
    }
  }
}

let lastAction = Number.NEGATIVE_INFINITY
let lastTarget: Element | null = null
let listening = false

function listen() {
  if (listening || typeof document === 'undefined') {
    return
  }
  listening = true
  const record = (event: Event) => {
    lastAction = performance.now()
    lastTarget = event.target instanceof Element ? event.target : null
  }
  document.addEventListener('pointerdown', record, true)
  document.addEventListener('keydown', record, true)
}

function controlNow() {
  const active = document.activeElement
  return active && active !== document.body ? active : lastTarget
}

export function useCwaReveal(target: () => Element | null | undefined, shown: () => boolean) {
  listen()
  let mountedAt = Number.POSITIVE_INFINITY
  onMounted(() => {
    mountedAt = performance.now()
  })
  watch(shown, async (now) => {
    const at = performance.now()
    if (!now || lastAction < mountedAt || at - lastAction > USER_ACTION_WINDOW) {
      return
    }
    const control = controlNow()
    await nextTick()
    const el = target()
    el?.isConnected && revealElement(el, control)
  })
}
