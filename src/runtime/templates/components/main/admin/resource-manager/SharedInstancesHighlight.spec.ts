// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from 'vitest'
import { computed, nextTick, reactive, ref } from 'vue'
import type { Ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import SharedInstancesHighlight from './SharedInstancesHighlight.vue'
import * as cwaComposable from '#cwa/composables/cwa'
import { registerInstance, unregisterInstance } from '#cwa/admin/manageable-instances'
import type Cwa from '#cwa/cwa'

const COMPONENT = '/component/html_contents/shared'
const DRAFT = '/component/html_contents/shared-draft'
const OTHER = '/component/html_contents/other'

function elementAt(rect: { top: number, left: number, right: number, bottom: number }) {
  const element = document.createElement('div')
  element.getBoundingClientRect = vi.fn(() => ({ ...rect, width: rect.right - rect.left, height: rect.bottom - rect.top }) as DOMRect)
  document.body.appendChild(element)
  return element
}

const registered: Array<[Cwa, string, Ref<HTMLElement[]>]> = []

function register(cwa: Cwa, iri: string, elements: Ref<HTMLElement[]>) {
  registerInstance(cwa, iri, elements)
  registered.push([cwa, iri, elements])
}

function mockCwa(selected: { iri: string, domElements: Ref<HTMLElement[]> } | undefined) {
  const handlers: Record<string, Set<() => void>> = {}
  const state = reactive({ selected, pageIri: '/_/pages/home', loading: false })
  const cwa = {
    admin: {
      resourceStackManager: { currentStackItem: computed(() => state.selected) },
      eventBus: {
        on: vi.fn((event: string, handler: () => void) => {
          (handlers[event] ??= new Set()).add(handler)
        }),
        off: vi.fn((event: string, handler: () => void) => {
          handlers[event]?.delete(handler)
        }),
      },
    },
    resources: {
      findAllPublishableIris: vi.fn((iri: string) => [COMPONENT, DRAFT].includes(iri) ? [COMPONENT, DRAFT] : [iri]),
      displayPageIri: computed(() => state.pageIri),
      isLoading: computed(() => state.loading),
    },
  } as unknown as Cwa
  vi.spyOn(cwaComposable, 'useCwa').mockReturnValue(cwa)
  return { cwa, state, emit: (event: string) => handlers[event]?.forEach(handler => handler()) }
}

function outlines(wrapper: ReturnType<typeof mount>) {
  return wrapper.findAll('[data-testid="shared-instance-outline"]').map(outline => outline.attributes('style'))
}

describe('SharedInstancesHighlight', () => {
  afterEach(() => {
    for (const [cwa, iri, elements] of registered.splice(0)) {
      unregisterInstance(cwa, iri, elements)
    }
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  test('outlines the selected component\'s other on-screen copies, never the selected one', async () => {
    const selectedElements = ref([elementAt({ top: 10, left: 20, right: 120, bottom: 60 })])
    const { cwa } = mockCwa({ iri: COMPONENT, domElements: selectedElements })
    register(cwa, COMPONENT, selectedElements)
    register(cwa, COMPONENT, ref([elementAt({ top: 300, left: 40, right: 240, bottom: 380 })]))
    register(cwa, OTHER, ref([elementAt({ top: 0, left: 0, right: 5, bottom: 5 })]))

    const wrapper = mount(SharedInstancesHighlight, { global: { stubs: { teleport: true } } })
    await flushPromises()

    expect(outlines(wrapper)).toEqual(['top: 300px; left: 40px; width: 200px; height: 80px;'])
  })

  test('counts a draft and its published component as the same component', async () => {
    const selectedElements = ref([elementAt({ top: 10, left: 20, right: 120, bottom: 60 })])
    const { cwa } = mockCwa({ iri: DRAFT, domElements: selectedElements })
    register(cwa, DRAFT, selectedElements)
    register(cwa, COMPONENT, ref([elementAt({ top: 300, left: 40, right: 240, bottom: 380 })]))

    const wrapper = mount(SharedInstancesHighlight, { global: { stubs: { teleport: true } } })
    await flushPromises()

    expect(outlines(wrapper)).toHaveLength(1)
  })

  test('the selected copy is left out even when the stack item holds its elements unwrapped', async () => {
    const selectedElements = ref([elementAt({ top: 10, left: 20, right: 120, bottom: 60 })])
    const { cwa } = mockCwa(reactive({ iri: COMPONENT, domElements: selectedElements }) as any)
    register(cwa, COMPONENT, selectedElements)

    const wrapper = mount(SharedInstancesHighlight, { global: { stubs: { teleport: true } } })
    await flushPromises()

    expect(outlines(wrapper)).toEqual([])
  })

  test('outlines a copy that mounts while selected, and drops it when it unmounts or the selection moves on', async () => {
    const selectedElements = ref([elementAt({ top: 10, left: 20, right: 120, bottom: 60 })])
    const { cwa, state } = mockCwa({ iri: COMPONENT, domElements: selectedElements })
    register(cwa, COMPONENT, selectedElements)
    const wrapper = mount(SharedInstancesHighlight, { global: { stubs: { teleport: true } } })
    await flushPromises()
    expect(outlines(wrapper)).toEqual([])

    const copy = ref([elementAt({ top: 300, left: 40, right: 240, bottom: 380 })])
    registerInstance(cwa, COMPONENT, copy)
    await nextTick()
    expect(outlines(wrapper)).toHaveLength(1)

    unregisterInstance(cwa, COMPONENT, copy)
    await nextTick()
    expect(outlines(wrapper)).toEqual([])

    register(cwa, COMPONENT, copy)
    state.selected = { iri: OTHER, domElements: ref([]) }
    await nextTick()
    expect(outlines(wrapper)).toEqual([])
  })

  test('skips a copy whose elements have left the page', async () => {
    const selectedElements = ref([elementAt({ top: 10, left: 20, right: 120, bottom: 60 })])
    const { cwa } = mockCwa({ iri: COMPONENT, domElements: selectedElements })
    register(cwa, COMPONENT, selectedElements)
    const detached = elementAt({ top: 300, left: 40, right: 240, bottom: 380 })
    detached.remove()
    register(cwa, COMPONENT, ref([detached]))

    const wrapper = mount(SharedInstancesHighlight, { global: { stubs: { teleport: true } } })
    await flushPromises()

    expect(outlines(wrapper)).toEqual([])
  })

  test.each(['redrawFocus', 'resize'])('redraws on %s', async (trigger) => {
    const selectedElements = ref([elementAt({ top: 10, left: 20, right: 120, bottom: 60 })])
    const { cwa, emit } = mockCwa({ iri: COMPONENT, domElements: selectedElements })
    register(cwa, COMPONENT, selectedElements)
    const copy = elementAt({ top: 300, left: 40, right: 240, bottom: 380 })
    register(cwa, COMPONENT, ref([copy]))
    const wrapper = mount(SharedInstancesHighlight, { global: { stubs: { teleport: true } } })
    await flushPromises()
    copy.getBoundingClientRect = vi.fn(() => ({ top: 400, left: 40, right: 240, bottom: 480 }) as DOMRect)

    if (trigger === 'resize') {
      window.dispatchEvent(new Event('resize'))
    }
    else {
      emit('redrawFocus')
    }
    await nextTick()

    expect(outlines(wrapper)[0]).toContain('top: 400px')
  })

  test('is styled apart from the selection and the clone highlight', async () => {
    const selectedElements = ref([elementAt({ top: 10, left: 20, right: 120, bottom: 60 })])
    const { cwa } = mockCwa({ iri: COMPONENT, domElements: selectedElements })
    register(cwa, COMPONENT, selectedElements)
    register(cwa, COMPONENT, ref([elementAt({ top: 300, left: 40, right: 240, bottom: 380 })]))
    const wrapper = mount(SharedInstancesHighlight, { global: { stubs: { teleport: true } } })
    await flushPromises()

    const classes = wrapper.get('[data-testid="shared-instance-outline"]').classes()
    expect(classes).toContain('cwa:outline-dotted')
    expect(classes).not.toContain('cwa:outline-yellow')
    expect(classes).not.toContain('cwa:outline-dashed')
  })

  test('stops listening once unmounted', async () => {
    const { cwa } = mockCwa(undefined)
    const removeSpy = vi.spyOn(window, 'removeEventListener')
    const wrapper = mount(SharedInstancesHighlight, { global: { stubs: { teleport: true } } })
    const [[, redrawHandler]] = vi.mocked(cwa.admin.eventBus.on).mock.calls as any

    wrapper.unmount()

    expect(cwa.admin.eventBus.off).toHaveBeenCalledWith('redrawFocus', redrawHandler)
    expect(removeSpy).toHaveBeenCalledWith('resize', redrawHandler)
  })
})
