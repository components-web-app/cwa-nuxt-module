export const LONG_PRESS_MS = 500
const SLOP_PX = 8
const SWALLOW_MS = 1000
const pressed = new WeakSet<Event>()

function isEditable(target: EventTarget | null) {
  return target instanceof Element && !!target.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]')
}

function listen(root: Document | HTMLElement) {
  let timer: ReturnType<typeof setTimeout> | undefined
  let start: { x: number, y: number, id: number } | undefined
  let fired = false
  let swallowUntil = 0

  function cancel() {
    clearTimeout(timer)
    timer = undefined
    start = undefined
  }

  function onDown(event: PointerEvent) {
    cancel()
    fired = false
    if (event.pointerType !== 'touch' || isEditable(event.target)) {
      return
    }
    const target = event.target
    start = { x: event.clientX, y: event.clientY, id: event.pointerId }
    const { x, y } = start
    timer = setTimeout(() => {
      timer = undefined
      fired = true
      swallowUntil = Date.now() + SWALLOW_MS
      const contextMenu = new MouseEvent('contextmenu', { clientX: x, clientY: y, button: 2, bubbles: true, cancelable: true })
      pressed.add(contextMenu)
      target?.dispatchEvent(contextMenu)
    }, LONG_PRESS_MS)
  }

  function onMove(event: PointerEvent) {
    if (start && event.pointerId === start.id && Math.hypot(event.clientX - start.x, event.clientY - start.y) > SLOP_PX) {
      cancel()
    }
  }

  function onUp() {
    if (fired) {
      swallowUntil = Date.now() + SWALLOW_MS
    }
    cancel()
  }

  function swallow(event: Event) {
    if (pressed.has(event)) {
      return
    }
    if (timer || (fired && Date.now() < swallowUntil)) {
      event.preventDefault()
      event.stopImmediatePropagation()
    }
  }

  function onClick(event: Event) {
    if (fired && Date.now() < swallowUntil) {
      fired = false
      event.preventDefault()
      event.stopImmediatePropagation()
    }
  }

  const listeners: [string, EventListener][] = [
    ['pointerdown', onDown as EventListener],
    ['pointermove', onMove as EventListener],
    ['pointerup', onUp],
    ['pointercancel', cancel],
    ['contextmenu', swallow],
    ['click', onClick],
  ]
  listeners.forEach(([type, listener]) => root.addEventListener(type, listener, { capture: true }))
  return () => {
    cancel()
    listeners.forEach(([type, listener]) => root.removeEventListener(type, listener, { capture: true }))
  }
}

const listening = new WeakMap<Document | HTMLElement, { count: number, stop: () => void }>()

export function listenForLongPress(root: Document | HTMLElement) {
  const entry = listening.get(root) ?? { count: 0, stop: listen(root) }
  entry.count++
  listening.set(root, entry)
  let stopped = false
  return () => {
    if (stopped) {
      return
    }
    stopped = true
    if (--entry.count === 0) {
      entry.stop()
      listening.delete(root)
    }
  }
}
