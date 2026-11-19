import { vi } from 'vitest'
import { REDUCED_MOTION_QUERY, SHEET_QUERY } from '../../src/runtime/templates/components/core/ui/sheet-media'

export function onPhone(phone = true, { reducedMotion = false } = {}) {
  vi.stubGlobal('matchMedia', vi.fn((query: string) => ({ matches: (phone && query === SHEET_QUERY) || (reducedMotion && query === REDUCED_MOTION_QUERY), media: query, addEventListener() {}, removeEventListener() {} })))
}

export function drag(target: Element, from: number, moves: number[], { at = 0, step = 16, release = true } = {}) {
  let now = at
  const clock = vi.spyOn(performance, 'now').mockImplementation(() => now)
  const event = (type: string, clientY: number) => new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 1, pointerType: 'touch', isPrimary: true, button: 0, clientX: 20, clientY })
  target.dispatchEvent(event('pointerdown', from))
  let last = from
  for (const y of moves) {
    now += step
    last = y
    target.dispatchEvent(event('pointermove', y))
  }
  if (release) {
    target.dispatchEvent(event('pointerup', last))
  }
  clock.mockRestore()
}

export function stubVisualViewport(viewport: { height: number, offsetTop?: number }) {
  const listeners = new Map<string, Set<() => void>>()
  const stub = {
    offsetTop: 0,
    ...viewport,
    addEventListener: (type: string, listener: () => void) => listeners.set(type, (listeners.get(type) ?? new Set()).add(listener)),
    removeEventListener: (type: string, listener: () => void) => listeners.get(type)?.delete(listener),
  }
  vi.stubGlobal('visualViewport', stub)
  return {
    resize(next: { height: number, offsetTop?: number }) {
      Object.assign(stub, next)
      listeners.get('resize')?.forEach(listener => listener())
    },
    listening: () => (listeners.get('resize')?.size ?? 0) + (listeners.get('scroll')?.size ?? 0),
  }
}
