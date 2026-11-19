import { vi } from 'vitest'
import { SHEET_QUERY } from '../../src/runtime/templates/components/core/ui/sheet-media'

export function onPhone(phone = true) {
  vi.stubGlobal('matchMedia', vi.fn((query: string) => ({ matches: phone && query === SHEET_QUERY, media: query, addEventListener() {}, removeEventListener() {} })))
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
