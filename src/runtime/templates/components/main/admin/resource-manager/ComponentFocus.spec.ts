// @vitest-environment happy-dom
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { computed, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import ComponentFocus from './ComponentFocus.vue'
import * as cwaComposable from '#cwa/composables/cwa'

// uuid is mocked so assignReorderId is deterministic
vi.mock('uuid', () => ({ v4: vi.fn(() => 'mock-reorder-id') }))

// useElementSize / useWindowSize are mocked — happy-dom does not implement
// ResizeObserver and we want to control the reactive width/height values.
const { elementSizeInstances, windowSizeRef } = vi.hoisted(() => ({
  elementSizeInstances: [] as Array<{ width: any, height: any, stop: any }>,
  windowSizeRef: { width: null as any, height: null as any },
}))

vi.mock('@vueuse/core', async () => {
  const { ref } = await import('vue')
  windowSizeRef.width = ref(1024)
  windowSizeRef.height = ref(768)
  return {
    useWindowSize: () => ({ width: windowSizeRef.width, height: windowSizeRef.height }),
    useElementSize: vi.fn((_el: any) => {
      const instance = { width: ref(10), height: ref(20), stop: vi.fn() }
      elementSizeInstances.push(instance)
      return instance
    }),
  }
})

// Shared admin event bus mock so we can capture the registered handlers.
const eventHandlers: Record<string, ((...args: any[]) => void)> = {}

function makeEventBus() {
  return {
    on: vi.fn((event: string, cb: (...args: any[]) => void) => {
      eventHandlers[event] = cb
    }),
    off: vi.fn((event: string) => {
      delete eventHandlers[event]
    }),
  }
}

let emitRedraw: ReturnType<typeof vi.fn>
let getResourceMock: ReturnType<typeof vi.fn>

function mockCwa(getResourceImpl: (iri: string) => any = () => ref(undefined)) {
  emitRedraw = vi.fn()
  getResourceMock = vi.fn(getResourceImpl)
  // @ts-expect-error partial mock
  vi.spyOn(cwaComposable, 'useCwa').mockImplementation(() => ({
    admin: {
      eventBus: makeEventBus(),
      emitRedraw,
    },
    resources: { getResource: getResourceMock },
  }))
}

// A fake DOM element implementing the minimal interface ComponentFocus needs.
function makeEl(rect: Partial<DOMRect>, nodeType = 1) {
  return {
    nodeType,
    getBoundingClientRect: () => ({
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: 0,
      height: 0,
      ...rect,
    }),
  } as unknown as HTMLElement
}

function mountFocus({
  iri = '/component/foo',
  els = [makeEl({ top: 10, left: 20, right: 120, bottom: 60 })],
}: { iri?: string | undefined, els?: HTMLElement[] } = {}) {
  const iriRef = ref<string | undefined>(iri)
  const domElementsRef = computed(() => els)
  const wrapper = mount(ComponentFocus, {
    props: {
      // These props are themselves refs/computed in real usage (passed by
      // resource-stack-manager via createApp), so we pass refs here too.
      iri: iriRef,
      domElements: domElementsRef,
    } as any,
    global: {
      stubs: {
        // client-only renders its default slot synchronously
        'client-only': { template: '<div><slot /></div>' },
      },
    },
  })
  return { wrapper, iriRef, domElementsRef }
}

beforeEach(() => {
  vi.clearAllMocks()
  elementSizeInstances.length = 0
  for (const k of Object.keys(eventHandlers)) delete eventHandlers[k]
  if (windowSizeRef.width) windowSizeRef.width.value = 1024
  if (windowSizeRef.height) windowSizeRef.height.value = 768
})

describe('ComponentFocus', () => {
  describe('rendering', () => {
    test('renders a canvas and the outline div', () => {
      mockCwa()
      const { wrapper } = mountFocus()
      expect(wrapper.find('canvas').exists()).toBe(true)
      expect(wrapper.find('div.cwa\\:animate-pulse').exists()).toBe(true)
    })

    test('computes the css position from the dom element bounding rects', () => {
      mockCwa()
      const { wrapper } = mountFocus({
        els: [makeEl({ top: 10, left: 20, right: 120, bottom: 60 })],
      })
      const style = wrapper.find('div.cwa\\:animate-pulse').attributes('style') ?? ''
      expect(style).toContain('top: 10px')
      expect(style).toContain('left: 20px')
      expect(style).toContain('width: 100px') // right(120) - left(20)
      expect(style).toContain('height: 50px') // bottom(60) - top(10)
    })

    test('takes the union (min top/left, max width/height) across multiple elements', () => {
      mockCwa()
      const { wrapper } = mountFocus({
        els: [
          makeEl({ top: 50, left: 50, right: 100, bottom: 100 }),
          makeEl({ top: 10, left: 5, right: 200, bottom: 80 }),
        ],
      })
      const style = wrapper.find('div.cwa\\:animate-pulse').attributes('style') ?? ''
      expect(style).toContain('top: 10px')
      expect(style).toContain('left: 5px')
      // width = max(right) - min(left) = 200 - 5 = 195
      expect(style).toContain('width: 195px')
      // height is computed as max(bottom - top) where top is the running min at
      // the time each element is processed. el1: 100-50=50; el2: top becomes 10,
      // 80-10=70 → max is 70.
      expect(style).toContain('height: 70px')
    })

    test('ignores non-element nodes (nodeType !== 1)', () => {
      mockCwa()
      const { wrapper } = mountFocus({
        els: [makeEl({ top: 10, left: 20, right: 120, bottom: 60 }, 3 /* text node */)],
      })
      const style = wrapper.find('div.cwa\\:animate-pulse').attributes('style') ?? ''
      // No element contributed → top/left remain the huge clear coords, width/height 0
      expect(style).toContain('width: 0px')
      expect(style).toContain('height: 0px')
    })
  })

  describe('borderColor', () => {
    test('is undefined (no border class) when resource is missing', () => {
      mockCwa(() => ref(undefined))
      const { wrapper } = mountFocus()
      const cls = wrapper.find('div.cwa\\:animate-pulse').classes()
      expect(cls).not.toContain('cwa:outline-green')
      expect(cls).not.toContain('cwa:outline-orange')
      expect(cls).not.toContain('cwa:outline-magenta')
    })

    test('is orange when the resource is being added', () => {
      mockCwa(() => ref({ data: { _metadata: { adding: true } } }))
      const { wrapper } = mountFocus()
      expect(wrapper.find('div.cwa\\:animate-pulse').classes()).toContain('cwa:outline-orange')
    })

    test('is green when published state is true', () => {
      mockCwa(() => ref({ data: { _metadata: { publishable: { published: true } } } }))
      const { wrapper } = mountFocus()
      expect(wrapper.find('div.cwa\\:animate-pulse').classes()).toContain('cwa:outline-green')
    })

    test('is orange when published state is false', () => {
      mockCwa(() => ref({ data: { _metadata: { publishable: { published: false } } } }))
      const { wrapper } = mountFocus()
      expect(wrapper.find('div.cwa\\:animate-pulse').classes()).toContain('cwa:outline-orange')
    })

    test('is magenta for a non-publishable resource with a /_/ iri', () => {
      mockCwa(() => ref({ data: { _metadata: {} } }))
      const { wrapper } = mountFocus({ iri: '/_/component_groups/abc' })
      expect(wrapper.find('div.cwa\\:animate-pulse').classes()).toContain('cwa:outline-magenta')
    })

    test('is green for a non-publishable resource with a non /_/ iri', () => {
      mockCwa(() => ref({ data: { _metadata: {} } }))
      const { wrapper } = mountFocus({ iri: '/component/foo' })
      expect(wrapper.find('div.cwa\\:animate-pulse').classes()).toContain('cwa:outline-green')
    })
  })

  describe('resource resolution', () => {
    test('returns no resource (falsy iri) without calling getResource', () => {
      mockCwa()
      mountFocus({ iri: '' })
      expect(getResourceMock).not.toHaveBeenCalled()
    })

    test('resolves the resource from the store by iri', () => {
      mockCwa(() => ref({ data: { _metadata: {} } }))
      mountFocus({ iri: '/component/foo' })
      expect(getResourceMock).toHaveBeenCalledWith('/component/foo')
    })
  })

  describe('event bus wiring', () => {
    test('registers redrawFocus and reorder listeners on mount', () => {
      mockCwa()
      mountFocus()
      expect(eventHandlers.redrawFocus).toBeTypeOf('function')
      expect(eventHandlers.reorder).toBeTypeOf('function')
    })

    test('removes the listeners on unmount', () => {
      mockCwa()
      const { wrapper } = mountFocus()
      expect(eventHandlers.redrawFocus).toBeTypeOf('function')
      wrapper.unmount()
      expect(eventHandlers.redrawFocus).toBeUndefined()
      expect(eventHandlers.reorder).toBeUndefined()
    })

    test('reorder event assigns a new reorderId from uuid', async () => {
      mockCwa()
      const { wrapper } = mountFocus()
      // reorderId feeds the position computed; trigger the handler then assert
      // the computed re-runs without error.
      eventHandlers.reorder()
      await nextTick()
      expect(wrapper.find('div.cwa\\:animate-pulse').exists()).toBe(true)
    })

    test('redrawFocus handler invokes drawCanvas without throwing', () => {
      mockCwa()
      mountFocus()
      expect(() => eventHandlers.redrawFocus()).not.toThrow()
    })
  })

  describe('elementSize instances watcher', () => {
    test('creates a useElementSize instance per dom element on mount (immediate watch)', () => {
      mockCwa()
      mountFocus({
        els: [
          makeEl({ top: 0, left: 0, right: 10, bottom: 10 }),
          makeEl({ top: 0, left: 0, right: 10, bottom: 10 }),
        ],
      })
      expect(elementSizeInstances.length).toBe(2)
    })

    test('stops previous instances and recreates when domElements change', async () => {
      mockCwa()
      // Use a mutable ref of elements so the watched computed changes.
      const elsRef = ref<HTMLElement[]>([makeEl({ top: 0, left: 0, right: 10, bottom: 10 })])
      const iriRef = ref<string | undefined>('/component/foo')
      mount(ComponentFocus, {
        props: {
          iri: iriRef,
          domElements: computed(() => elsRef.value),
        } as any,
        global: { stubs: { 'client-only': { template: '<div><slot /></div>' } } },
      })
      expect(elementSizeInstances.length).toBe(1)
      const firstInstance = elementSizeInstances[0]

      elsRef.value = [
        makeEl({ top: 0, left: 0, right: 10, bottom: 10 }),
        makeEl({ top: 0, left: 0, right: 10, bottom: 10 }),
      ]
      await nextTick()
      expect(firstInstance.stop).toHaveBeenCalled()
      expect(elementSizeInstances.length).toBe(3) // 1 original + 2 new
    })
  })

  describe('exposed api', () => {
    test('exposes redraw()', () => {
      mockCwa()
      const { wrapper } = mountFocus()
      expect((wrapper.vm as any).redraw).toBeTypeOf('function')
      expect(() => (wrapper.vm as any).redraw()).not.toThrow()
    })
  })

  describe('drawCanvas', () => {
    test('draws onto the canvas 2d context when available', async () => {
      mockCwa()
      // Provide a fake 2d context since happy-dom canvas getContext returns null.
      const ctx = {
        reset: vi.fn(),
        beginPath: vi.fn(),
        rect: vi.fn(),
        fill: vi.fn(),
        moveTo: vi.fn(),
        arcTo: vi.fn(),
        fillStyle: '',
      }
      const getContextSpy = vi
        .spyOn(HTMLCanvasElement.prototype, 'getContext')
        .mockReturnValue(ctx as any)

      const { wrapper } = mountFocus()
      ;(wrapper.vm as any).redraw()
      await nextTick()

      expect(getContextSpy).toHaveBeenCalledWith('2d')
      expect(ctx.reset).toHaveBeenCalled()
      expect(ctx.rect).toHaveBeenCalled()
      // drawRoundedRect issues 4 arcTo calls
      expect(ctx.arcTo).toHaveBeenCalledTimes(4)
      expect(ctx.fill).toHaveBeenCalled()
      getContextSpy.mockRestore()
    })

    test('does nothing when the canvas 2d context is unavailable', () => {
      mockCwa()
      const getContextSpy = vi
        .spyOn(HTMLCanvasElement.prototype, 'getContext')
        .mockReturnValue(null as any)
      const { wrapper } = mountFocus()
      expect(() => (wrapper.vm as any).redraw()).not.toThrow()
      getContextSpy.mockRestore()
    })
  })
})
