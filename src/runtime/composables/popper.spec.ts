// @vitest-environment happy-dom

import { describe, expect, test, vi, beforeEach } from 'vitest'
import { ref } from 'vue'

import { usePopper, createPopper } from './popper'

const { mockPopperInstance, mockCreatePopper, mockPopperGenerator } = vi.hoisted(() => {
  const inst = { destroy: vi.fn() }
  const create = vi.fn(() => inst)
  return { mockPopperInstance: inst, mockCreatePopper: create, mockPopperGenerator: vi.fn(() => create) }
})

vi.mock('@popperjs/core/lib/popper-lite', () => ({
  popperGenerator: (...args: any[]) => mockPopperGenerator(...args),
  defaultModifiers: [],
}))
vi.mock('@popperjs/core/lib/modifiers/flip', () => ({ default: { name: 'flip' } }))
vi.mock('@popperjs/core/lib/modifiers/offset', () => ({ default: { name: 'offset' } }))
vi.mock('@popperjs/core/lib/modifiers/preventOverflow', () => ({ default: { name: 'preventOverflow' } }))
vi.mock('@popperjs/core/lib/modifiers/computeStyles', () => ({ default: { name: 'computeStyles' } }))
vi.mock('@popperjs/core/lib/modifiers/eventListeners', () => ({ default: { name: 'eventListeners' } }))

let watchEffectCb: ((onInvalidate: (fn: () => void) => void) => void) | undefined
vi.mock('vue', async () => {
  const mod = await vi.importActual<typeof import('vue')>('vue')
  return {
    ...mod,
    onMounted: vi.fn((fn: () => void) => fn()),
    watchEffect: vi.fn((fn: any) => { watchEffectCb = fn }),
  }
})

const mockUnrefElement = vi.fn((r: any) => r?.value)
vi.mock('@vueuse/core', () => ({
  unrefElement: (...args: any[]) => mockUnrefElement(...args),
}))

describe('usePopper', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    watchEffectCb = undefined
    mockUnrefElement.mockImplementation((r: any) => r?.value)
    mockCreatePopper.mockReturnValue(mockPopperInstance)
  })

  test('createPopper is the generated popper factory', () => {
    expect(createPopper).toBe(mockCreatePopper)
  })

  test('returns reference, popper and instance refs', () => {
    const [reference, popper, instance] = usePopper({})
    expect(reference.value).toBeNull()
    expect(popper.value).toBeNull()
    expect(instance.value).toBeNull()
  })

  test('does nothing when popper element is not set', () => {
    usePopper({})
    watchEffectCb?.(() => {})
    expect(mockCreatePopper).not.toHaveBeenCalled()
  })

  test('does nothing when neither reference nor virtualReference is set', () => {
    const [, popper] = usePopper({})
    popper.value = document.createElement('div')
    watchEffectCb?.(() => {})
    expect(mockCreatePopper).not.toHaveBeenCalled()
  })

  test('does nothing when popper element is not an HTMLElement', () => {
    const [reference, popper] = usePopper({})
    reference.value = document.createElement('div')
    popper.value = {} as any // not an HTMLElement
    watchEffectCb?.(() => {})
    expect(mockCreatePopper).not.toHaveBeenCalled()
  })

  test('creates popper instance when reference and popper elements are set', () => {
    const [reference, popper, instance] = usePopper({})
    const refEl = document.createElement('div')
    const popEl = document.createElement('div')
    reference.value = refEl
    popper.value = popEl

    watchEffectCb?.(() => {})

    expect(mockCreatePopper).toHaveBeenCalledWith(refEl, popEl, expect.any(Object))
    expect(typeof instance.value?.destroy).toBe('function')
  })

  test('uses virtualReference when provided', () => {
    const virtualEl = document.createElement('div')
    const virtualReference = ref(virtualEl)
    const [, popper] = usePopper({}, virtualReference)
    const popEl = document.createElement('div')
    popper.value = popEl

    watchEffectCb?.(() => {})

    expect(mockCreatePopper).toHaveBeenCalledWith(virtualEl, popEl, expect.any(Object))
  })

  test('registers destroy via onInvalidate', () => {
    const [reference, popper] = usePopper({})
    reference.value = document.createElement('div')
    popper.value = document.createElement('div')
    const onInvalidate = vi.fn()

    watchEffectCb?.(onInvalidate)

    expect(onInvalidate).toHaveBeenCalledWith(expect.any(Function))
  })

  test('flip modifier disabled when locked is true', () => {
    const [reference, popper] = usePopper({ locked: true })
    reference.value = document.createElement('div')
    popper.value = document.createElement('div')

    watchEffectCb?.(() => {})

    const modifiers = mockCreatePopper.mock.calls[0][2].modifiers
    const flipMod = modifiers.find((m: any) => m.name === 'flip')
    expect(flipMod.enabled).toBe(false)
  })

  test('sameWidth modifier fn and effect apply width styles', () => {
    const [reference, popper] = usePopper({})
    reference.value = document.createElement('div')
    popper.value = document.createElement('div')

    watchEffectCb?.(() => {})

    const modifiers = mockCreatePopper.mock.calls[0][2].modifiers
    const sameWidth = modifiers.find((m: any) => m.name === 'sameWidth')

    const fnState = { styles: { popper: {} }, rects: { reference: { width: 120 } } }
    sameWidth.fn({ state: fnState })
    expect(fnState.styles.popper.width).toBe('auto')
    expect(fnState.styles.popper.minWidth).toBe('120px')

    const popperEl = document.createElement('div')
    const referenceEl = document.createElement('div')
    Object.defineProperty(referenceEl, 'offsetWidth', { value: 200, configurable: true })
    const effectState = { elements: { popper: popperEl, reference: referenceEl } }
    sameWidth.effect({ state: effectState })
    expect(popperEl.style.width).toBe('auto')
    expect(popperEl.style.minWidth).toBe('200px')
  })

  test('sameWidth fn and effect handle missing state gracefully', () => {
    const [reference, popper] = usePopper({})
    reference.value = document.createElement('div')
    popper.value = document.createElement('div')

    watchEffectCb?.(() => {})

    const modifiers = mockCreatePopper.mock.calls[0][2].modifiers
    const sameWidth = modifiers.find((m: any) => m.name === 'sameWidth')

    expect(() => sameWidth.fn({ state: null })).not.toThrow()
    expect(() => sameWidth.effect({ state: null })).not.toThrow()
  })
})
