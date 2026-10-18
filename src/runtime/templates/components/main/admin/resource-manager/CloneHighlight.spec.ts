// @vitest-environment happy-dom
import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest'
import { nextTick, reactive, ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import CloneHighlight from './CloneHighlight.vue'
import * as cwaComposable from '#cwa/composables/cwa'
import { registerInstance, unregisterInstance } from '#cwa/admin/manageable-instances'
import { useCloneMode } from '#cwa/admin/clone-mode'
import type Cwa from '#cwa/cwa'

const SOURCE_IRI = '/component/html_contents/source'
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
const cwas: Cwa[] = []

function mockCwa() {
  const handlers: Record<string, Set<() => void>> = {}
  const admin = reactive({
    isEditing: true,
    setNavigationGuardDisabled: vi.fn(),
    eventBus: {
      on: vi.fn((event: string, handler: () => void) => {
        (handlers[event] ??= new Set()).add(handler)
      }),
      off: vi.fn((event: string, handler: () => void) => {
        handlers[event]?.delete(handler)
      }),
    },
  })
  const cwa = {
    admin,
    auth: reactive({ user: { '@id': '/_/users/admin' } }),
    resources: {
      findAllPublishableIris: vi.fn((iri: string) => [iri]),
    },
  } as unknown as Cwa
  cwas.push(cwa)
  vi.spyOn(cwaComposable, 'useCwa').mockImplementation(() => cwa)
  return {
    cwa,
    emit: (event: string) => handlers[event]?.forEach(handler => handler()),
  }
}

function elementAt(rect: { top: number, left: number, right: number, bottom: number }) {
  const element = document.createElement('div')
  element.getBoundingClientRect = vi.fn(() => ({ ...rect, width: rect.right - rect.left, height: rect.bottom - rect.top }) as DOMRect)
  document.body.appendChild(element)
  return element
}

function mountHighlight() {
  return mount(CloneHighlight, { global: { stubs: { teleport: true } } })
}

beforeAll(async () => {
  await import('#cwa/admin/manageable-resource')
})

afterEach(() => {
  for (const cwa of cwas.splice(0)) {
    useCloneMode(cwa).end()
  }
  vi.restoreAllMocks()
})

describe('CloneHighlight', () => {
  test('leaves out an instance whose elements have left the page, so navigating away leaves no highlight behind', async () => {
    const { cwa } = mockCwa()
    const detached = elementAt({ top: 10, left: 20, right: 120, bottom: 60 })
    detached.remove()
    registerInstance(cwa, SOURCE_IRI, ref([detached]))
    registerInstance(cwa, SOURCE_IRI, ref([elementAt({ top: 300, left: 40, right: 240, bottom: 380 })]))
    useCloneMode(cwa).start(SOURCE_IRI, 'Html Content')

    const wrapper = mountHighlight()
    await flushPromises()

    const highlights = wrapper.findAll('[data-testid="clone-highlight"]')
    expect(highlights).toHaveLength(1)
    expect(highlights[0].attributes('style')).toBe('top: 300px; left: 40px; width: 200px; height: 80px;')
  })

  test('highlights every on-screen instance of the clone source', async () => {
    const { cwa } = mockCwa()
    registerInstance(cwa, SOURCE_IRI, ref([elementAt({ top: 10, left: 20, right: 120, bottom: 60 })]))
    registerInstance(cwa, SOURCE_IRI, ref([elementAt({ top: 300, left: 40, right: 240, bottom: 380 })]))
    registerInstance(cwa, '/component/html_contents/other', ref([elementAt({ top: 0, left: 0, right: 5, bottom: 5 })]))
    useCloneMode(cwa).start(SOURCE_IRI, 'Html Content')

    const wrapper = mountHighlight()
    await flushPromises()

    const highlights = wrapper.findAll('[data-testid="clone-highlight"]')
    expect(highlights).toHaveLength(2)
    expect(highlights[0].attributes('style')).toBe('top: 10px; left: 20px; width: 100px; height: 50px;')
    expect(highlights[1].attributes('style')).toBe('top: 300px; left: 40px; width: 200px; height: 80px;')
  })

  test('highlights an instance that mounts during clone mode, and drops one that unmounts', async () => {
    const { cwa } = mockCwa()
    useCloneMode(cwa).start(SOURCE_IRI)
    const wrapper = mountHighlight()
    await flushPromises()
    expect(wrapper.findAll('[data-testid="clone-highlight"]')).toHaveLength(0)

    const instance = ref([elementAt({ top: 10, left: 20, right: 120, bottom: 60 })])
    registerInstance(cwa, SOURCE_IRI, instance)
    await nextTick()
    expect(wrapper.findAll('[data-testid="clone-highlight"]')).toHaveLength(1)

    unregisterInstance(cwa, SOURCE_IRI, instance)
    await nextTick()
    expect(wrapper.findAll('[data-testid="clone-highlight"]')).toHaveLength(0)
  })

  test('renders nothing outside clone mode', async () => {
    const { cwa } = mockCwa()
    registerInstance(cwa, SOURCE_IRI, ref([elementAt({ top: 10, left: 20, right: 120, bottom: 60 })]))
    const cloneMode = useCloneMode(cwa)

    const wrapper = mountHighlight()
    await flushPromises()
    expect(wrapper.findAll('[data-testid="clone-highlight"]')).toHaveLength(0)

    cloneMode.start(SOURCE_IRI)
    await nextTick()
    expect(wrapper.findAll('[data-testid="clone-highlight"]')).toHaveLength(1)

    cloneMode.end()
    await nextTick()
    expect(wrapper.findAll('[data-testid="clone-highlight"]')).toHaveLength(0)
  })

  test('the clone highlight is styled differently from the selection outline', async () => {
    const { cwa } = mockCwa()
    registerInstance(cwa, SOURCE_IRI, ref([elementAt({ top: 10, left: 20, right: 120, bottom: 60 })]))
    useCloneMode(cwa).start(SOURCE_IRI)

    const wrapper = mountHighlight()
    await flushPromises()

    const classes = wrapper.get('[data-testid="clone-highlight"]').classes()
    expect(classes).toContain('cwa:outline-dashed')
    expect(classes).toContain('cwa:outline-yellow')
    expect(classes).not.toContain('cwa:animate-pulse')
    expect(classes).not.toContain('cwa:outline-green')
    expect(classes).not.toContain('cwa:outline-orange')
    expect(classes).not.toContain('cwa:outline-magenta')
  })

  test.each(['redrawFocus', 'resize'])('redraws on %s', async (trigger) => {
    const { cwa, emit } = mockCwa()
    const element = elementAt({ top: 10, left: 20, right: 120, bottom: 60 })
    registerInstance(cwa, SOURCE_IRI, ref([element]))
    useCloneMode(cwa).start(SOURCE_IRI)
    const wrapper = mountHighlight()
    await flushPromises()
    element.getBoundingClientRect = vi.fn(() => ({ top: 70, left: 20, right: 120, bottom: 120 }) as DOMRect)

    if (trigger === 'resize') {
      window.dispatchEvent(new Event('resize'))
    }
    else {
      emit('redrawFocus')
    }
    await nextTick()

    expect(wrapper.get('[data-testid="clone-highlight"]').attributes('style')).toContain('top: 70px')
  })

  test('stops redrawing once unmounted', () => {
    instanceListenerStops.length = 0
    const { cwa } = mockCwa()
    const removeSpy = vi.spyOn(window, 'removeEventListener')
    const wrapper = mountHighlight()
    const [[, redrawHandler]] = vi.mocked(cwa.admin.eventBus.on).mock.calls

    wrapper.unmount()

    expect(cwa.admin.eventBus.off).toHaveBeenCalledWith('redrawFocus', redrawHandler)
    expect(removeSpy).toHaveBeenCalledWith('resize', redrawHandler)
    expect(instanceListenerStops).toHaveLength(1)
    expect(instanceListenerStops[0]).toHaveBeenCalled()
  })
})
