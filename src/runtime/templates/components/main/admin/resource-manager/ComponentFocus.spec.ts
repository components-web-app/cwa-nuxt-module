// @vitest-environment happy-dom
import { describe, test, expect, vi, beforeAll, beforeEach } from 'vitest'
import { computed, nextTick, ref } from 'vue'
import type { Ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import ComponentFocus from './ComponentFocus.vue'
import * as cwaComposable from '#cwa/composables/cwa'
import { registerInstance, unregisterInstance } from '#cwa/admin/manageable-instances'
import type Cwa from '#cwa/cwa'

vi.mock('uuid', () => ({ v4: vi.fn(() => 'mock-reorder-id') }))

const { instanceListenerStops } = vi.hoisted(() => ({ instanceListenerStops: [] as Array<ReturnType<typeof vi.fn>> }))

vi.mock('#cwa/admin/manageable-instances', async (importOriginal) => {
  const actual = await importOriginal<typeof import('#cwa/admin/manageable-instances')>()
  return {
    ...actual,
    onInstancesChange: vi.fn((...args: Parameters<typeof actual.onInstancesChange>) => {
      const stop = vi.fn(actual.onInstancesChange(...args))
      instanceListenerStops.push(stop)
      return stop
    }),
  }
})

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
  const cwa = {
    admin: {
      eventBus: makeEventBus(),
      emitRedraw,
    },
    resources: {
      getResource: getResourceMock,
      findAllPublishableIris: vi.fn((iri: string) => [iri]),
    },
  } as unknown as Cwa
  vi.spyOn(cwaComposable, 'useCwa').mockImplementation(() => cwa)
  return cwa
}

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
  domElements,
}: { iri?: string | undefined, els?: HTMLElement[], domElements?: Ref<HTMLElement[]> } = {}) {
  const iriRef = ref<string | undefined>(iri)
  const domElementsRef = domElements ?? computed(() => els)
  const wrapper = mount(ComponentFocus, {
    props: {
      iri: iriRef,
      domElements: domElementsRef,
    } as any,
    global: {
      stubs: {
        'client-only': { template: '<div><slot /></div>' },
      },
    },
  })
  return { wrapper, iriRef, domElementsRef }
}

beforeAll(async () => {
  await import('#cwa/admin/manageable-resource')
})

beforeEach(() => {
  vi.clearAllMocks()
  instanceListenerStops.length = 0
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
      expect(style).toContain('width: 100px')
      expect(style).toContain('height: 50px')
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
      expect(style).toContain('width: 195px')
      expect(style).toContain('height: 70px')
    })

    test('ignores non-element nodes (nodeType !== 1)', () => {
      mockCwa()
      const { wrapper } = mountFocus({
        els: [makeEl({ top: 10, left: 20, right: 120, bottom: 60 }, 3 /* text node */)],
      })
      const style = wrapper.find('div.cwa\\:animate-pulse').attributes('style') ?? ''
      expect(style).toContain('width: 0px')
      expect(style).toContain('height: 0px')
    })
  })

  describe('every on-screen instance', () => {
    test('selecting one instance outlines every on-screen instance of the component', async () => {
      const cwa = mockCwa()
      const clicked = ref([makeEl({ top: 10, left: 20, right: 120, bottom: 60 })])
      const other = ref([makeEl({ top: 300, left: 40, right: 240, bottom: 380 })])
      const unrelated = ref([makeEl({ top: 500, left: 0, right: 10, bottom: 510 })])
      registerInstance(cwa, '/component/foo', clicked)
      registerInstance(cwa, '/component/foo', other)
      registerInstance(cwa, '/component/bar', unrelated)

      const { wrapper } = mountFocus({ domElements: clicked })
      await flushPromises()

      const outlines = wrapper.findAll('div.cwa\\:outline')
      expect(outlines).toHaveLength(2)
      const styles = outlines.map(outline => outline.attributes('style') ?? '')
      expect(styles[0]).toContain('top: 10px')
      expect(styles[0]).toContain('width: 100px')
      expect(styles[1]).toContain('top: 300px')
      expect(styles[1]).toContain('left: 40px')
      expect(styles[1]).toContain('width: 200px')
      expect(styles[1]).toContain('height: 80px')
    })

    test('outlines an instance that mounts while the component is selected, and drops one that unmounts', async () => {
      const cwa = mockCwa()
      const clicked = ref([makeEl({ top: 10, left: 20, right: 120, bottom: 60 })])
      registerInstance(cwa, '/component/foo', clicked)
      const { wrapper } = mountFocus({ domElements: clicked })
      await flushPromises()
      expect(wrapper.findAll('div.cwa\\:outline')).toHaveLength(1)

      const later = ref([makeEl({ top: 300, left: 40, right: 240, bottom: 380 })])
      registerInstance(cwa, '/component/foo', later)
      await nextTick()
      expect(wrapper.findAll('div.cwa\\:outline')).toHaveLength(2)

      unregisterInstance(cwa, '/component/foo', later)
      await nextTick()
      expect(wrapper.findAll('div.cwa\\:outline')).toHaveLength(1)
    })

    test('stops following the instances once unmounted', async () => {
      mockCwa()
      const { wrapper } = mountFocus()
      await flushPromises()
      expect(instanceListenerStops).toHaveLength(1)

      wrapper.unmount()

      expect(instanceListenerStops[0]).toHaveBeenCalled()
    })

    test('does not follow the instances when unmounted before they load', async () => {
      mockCwa()
      const { wrapper } = mountFocus()
      wrapper.unmount()

      await flushPromises()

      expect(instanceListenerStops).toHaveLength(0)
    })

    test('cuts every instance out of the canvas', async () => {
      const cwa = mockCwa()
      const clicked = ref([makeEl({ top: 10, left: 20, right: 120, bottom: 60 })])
      registerInstance(cwa, '/component/foo', clicked)
      registerInstance(cwa, '/component/foo', ref([makeEl({ top: 300, left: 40, right: 240, bottom: 380 })]))
      const ctx = { reset: vi.fn(), beginPath: vi.fn(), rect: vi.fn(), fill: vi.fn(), moveTo: vi.fn(), arcTo: vi.fn(), fillStyle: '' }
      const getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as any)

      const { wrapper } = mountFocus({ domElements: clicked })
      await flushPromises()
      ;(wrapper.vm as any).redraw()

      expect(ctx.moveTo).toHaveBeenCalledTimes(2)
      expect(ctx.moveTo).toHaveBeenCalledWith(13, 11)
      expect(ctx.moveTo).toHaveBeenCalledWith(33, 301)
      getContextSpy.mockRestore()
    })

    test('measures the size of every instance\'s elements', async () => {
      const cwa = mockCwa()
      const clicked = ref([makeEl({ top: 10, left: 20, right: 120, bottom: 60 })])
      registerInstance(cwa, '/component/foo', clicked)
      registerInstance(cwa, '/component/foo', ref([makeEl({ top: 300, left: 40, right: 240, bottom: 380 })]))

      mountFocus({ domElements: clicked })
      await flushPromises()

      expect(elementSizeInstances.filter(instance => !instance.stop.mock.calls.length)).toHaveLength(2)
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
      expect(elementSizeInstances.length).toBe(3)
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
