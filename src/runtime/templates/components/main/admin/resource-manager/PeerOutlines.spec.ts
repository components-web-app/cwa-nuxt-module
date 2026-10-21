// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from 'vitest'
import { computed, nextTick, reactive, ref } from 'vue'
import type { Ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { Router } from 'vue-router'
import PeerOutlines from './PeerOutlines.vue'
import * as cwaComposable from '#cwa/composables/cwa'
import { Presence, presenceColour } from '#cwa/admin/presence'
import { registerInstance, unregisterInstance } from '#cwa/admin/manageable-instances'
import { ResourcesStore } from '#cwa/storage/stores/resources/resources-store'
import type Cwa from '#cwa/cwa'

const appContainer = vi.hoisted(() => ({ element: undefined as HTMLElement | undefined }))

vi.mock('#app/nuxt', async importOriginal => ({
  ...await importOriginal<typeof import('#app/nuxt')>(),
  useNuxtApp: () => ({ vueApp: { _container: appContainer.element } }),
}))

const HOME = '/_/pages/home'
const ABOUT = '/_/pages/about'
const COMPONENT = '/component/html_contents/c1'
const DRAFT = '/component/html_contents/c1-draft'
const OTHER = '/component/html_contents/c2'
const POSITION = '/_/component_positions/p1'
const SAM = { id: '/users/sam', name: 'Sam' }
const ALEX = { id: '/users/alex', name: 'Alex' }
const ids = ['0a1b2c3d-1111-4aaa-8bbb-000000000001', '0a1b2c3d-1111-4aaa-8bbb-000000000002', '0a1b2c3d-1111-4aaa-8bbb-000000000003']

let presence: Presence | undefined
const mounted: { unmount: () => void }[] = []
const registered: Array<[Cwa, string, Ref<HTMLElement[]>]> = []

function mockCwa() {
  const handlers: Record<string, Set<() => void>> = {}
  const state = reactive({ pageIri: HOME, loading: false })
  const cwa = {
    apiUrlBase: 'https://api.test',
    cwaFetch: { fetch: vi.fn().mockResolvedValue(undefined) },
    resources: {
      displayPageIri: computed(() => state.pageIri),
      isLoading: computed(() => state.loading),
      pageDataIriOf: () => computed(() => undefined),
      findAllPublishableIris: (iri: string) => [COMPONENT, DRAFT].includes(iri) ? [COMPONENT, DRAFT] : [iri],
    },
    resourcesManager: { isUpdating: () => false },
    admin: {
      resourceStackManager: { currentIri: computed(() => undefined), getClosestStackItemByType: () => undefined },
      eventBus: {
        on: vi.fn((event: string, handler: () => void) => {
          (handlers[event] ??= new Set()).add(handler)
        }),
        off: vi.fn((event: string, handler: () => void) => {
          handlers[event]?.delete(handler)
        }),
      },
    },
  }
  vi.spyOn(cwaComposable, 'useCwa').mockReturnValue(cwa as unknown as Cwa)
  setActivePinia(createPinia())
  presence = new Presence(cwa as unknown as Cwa, new ResourcesStore('test').useStore(), { currentRoute: computed(() => ({ path: '/', meta: {} })) } as unknown as Router, '0a1b2c3d-1111-4aaa-8bbb-00000000000f')
  presence.start(true)
  return { cwa: cwa as unknown as Cwa, state, emit: (event: string) => handlers[event]?.forEach(handler => handler()) }
}

function arrive(clientId: string, user: { id: string, name?: string }, data: Record<string, unknown>) {
  presence!.receive({ '@type': 'CwaRealtimeEvent', 'v': 1, clientId, user, 'event': 'presence', 'data': { v: 1, state: 'selected', page: HOME, ...data }, 'sentAt': '2026-10-21T10:00:00Z', 'expiresAt': '2026-10-21T10:00:45Z' })
}

function elementAt(rect: { top: number, left: number, right: number, bottom: number }) {
  const element = document.createElement('div')
  element.getBoundingClientRect = vi.fn(() => ({ ...rect, width: rect.right - rect.left, height: rect.bottom - rect.top }) as DOMRect)
  document.body.appendChild(element)
  return element
}

function register(cwa: Cwa, iri: string, elements: HTMLElement[]) {
  const instance = ref(elements)
  registerInstance(cwa, iri, instance)
  registered.push([cwa, iri, instance])
  return instance
}

async function mountOutlines() {
  const wrapper = mount(PeerOutlines, { global: { stubs: { teleport: true } } })
  mounted.push(wrapper)
  await flushPromises()
  return wrapper
}

function outlines(wrapper: ReturnType<typeof mount>) {
  return wrapper.findAll('[data-testid="peer-outline"]')
}

function flags(wrapper: ReturnType<typeof mount>) {
  return wrapper.findAll('[data-testid="peer-flag"]')
}

afterEach(() => {
  mounted.splice(0).forEach(wrapper => wrapper.unmount())
  for (const [cwa, iri, elements] of registered.splice(0)) {
    unregisterInstance(cwa, iri, elements)
  }
  presence?.stop()
  presence = undefined
  document.body.innerHTML = ''
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('PeerOutlines (#429)', () => {
  test('mounts inside the app\'s own container, as the selection outline does', async () => {
    appContainer.element = document.createElement('div')
    document.body.appendChild(appContainer.element)
    const { cwa } = mockCwa()
    register(cwa, COMPONENT, [elementAt({ top: 10, left: 20, right: 120, bottom: 60 })])
    arrive(ids[0]!, SAM, { component: COMPONENT })
    try {
      const wrapper = mount(PeerOutlines)
      mounted.push(wrapper)
      await flushPromises()
      const outline = document.querySelector('[data-testid="peer-outline"]')
      expect(outline).not.toBeNull()
      expect(appContainer.element.contains(outline)).toBe(true)
    }
    finally {
      appContainer.element.remove()
      appContainer.element = undefined
    }
  })

  test('outlines every on-screen copy of a component another admin on this page has selected, in their colour and with their name', async () => {
    const { cwa } = mockCwa()
    register(cwa, COMPONENT, [elementAt({ top: 10, left: 20, right: 120, bottom: 60 })])
    register(cwa, DRAFT, [elementAt({ top: 300, left: 40, right: 240, bottom: 380 })])
    register(cwa, OTHER, [elementAt({ top: 0, left: 0, right: 5, bottom: 5 })])
    arrive(ids[0]!, SAM, { component: COMPONENT })

    const wrapper = await mountOutlines()

    expect(outlines(wrapper).map(outline => outline.attributes('style'))).toStrictEqual([
      `top: 10px; left: 20px; width: 100px; height: 50px; outline-color: ${presenceColour(SAM.id)};`,
      `top: 300px; left: 40px; width: 200px; height: 80px; outline-color: ${presenceColour(SAM.id)};`,
    ])
    expect(flags(wrapper).map(flag => flag.text())).toStrictEqual(['Sam', 'Sam'])
  })

  test('a peer with only a position selected outlines that position', async () => {
    const { cwa } = mockCwa()
    register(cwa, POSITION, [elementAt({ top: 10, left: 20, right: 120, bottom: 60 })])
    arrive(ids[0]!, SAM, { componentPosition: POSITION })

    const wrapper = await mountOutlines()

    expect(outlines(wrapper)).toHaveLength(1)
  })

  test('says who is editing', async () => {
    const { cwa } = mockCwa()
    register(cwa, COMPONENT, [elementAt({ top: 10, left: 20, right: 120, bottom: 60 })])
    arrive(ids[0]!, SAM, { state: 'editing', component: COMPONENT, componentPosition: POSITION, field: 'html' })

    const wrapper = await mountOutlines()

    expect(flags(wrapper).map(flag => flag.text())).toStrictEqual(['Sam is editing'])
  })

  test('peers on another page, or only viewing, are not outlined', async () => {
    const { cwa } = mockCwa()
    register(cwa, COMPONENT, [elementAt({ top: 10, left: 20, right: 120, bottom: 60 })])
    arrive(ids[0]!, SAM, { page: ABOUT, component: COMPONENT })
    arrive(ids[1]!, ALEX, { state: 'viewing' })

    const wrapper = await mountOutlines()

    expect(outlines(wrapper)).toHaveLength(0)
  })

  test('several people on one component share one outline in the first one\'s colour, with every name once', async () => {
    const { cwa } = mockCwa()
    register(cwa, COMPONENT, [elementAt({ top: 10, left: 20, right: 120, bottom: 60 })])
    arrive(ids[0]!, SAM, { component: COMPONENT })
    arrive(ids[1]!, SAM, { component: COMPONENT })
    arrive(ids[2]!, ALEX, { state: 'editing', component: DRAFT })

    const wrapper = await mountOutlines()

    expect(outlines(wrapper)).toHaveLength(1)
    expect(outlines(wrapper)[0]!.attributes('style')).toContain(`outline-color: ${presenceColour(SAM.id)}`)
    expect(flags(wrapper).map(flag => flag.text())).toStrictEqual(['Sam, Alex (editing)'])
  })

  test.each([
    { people: [SAM, ALEX], label: 'Sam and Alex are editing' },
    { people: [SAM, ALEX, { id: '/users/jo', name: 'Jo' }], label: 'Sam, Alex and Jo are editing' },
  ])('when everyone on a component is editing the flag says so once: $label', async ({ people, label }) => {
    const { cwa } = mockCwa()
    register(cwa, COMPONENT, [elementAt({ top: 300, left: 20, right: 120, bottom: 360 })])
    people.forEach((user, index) => arrive(ids[index]!, user, { state: 'editing', component: COMPONENT }))

    const wrapper = await mountOutlines()

    expect(flags(wrapper).map(flag => flag.text())).toStrictEqual([label])
  })

  test('the flag sits above the outline, or inside it where the admin header would cover it', async () => {
    const { cwa } = mockCwa()
    register(cwa, COMPONENT, [elementAt({ top: 80, left: 20, right: 120, bottom: 160 })])
    register(cwa, OTHER, [elementAt({ top: 300, left: 20, right: 120, bottom: 360 })])
    arrive(ids[0]!, SAM, { component: COMPONENT })
    arrive(ids[1]!, ALEX, { component: OTHER })

    const wrapper = await mountOutlines()

    const [underHeader, clear] = flags(wrapper)
    expect(underHeader!.classes()).toContain('cwa:top-0')
    expect(underHeader!.classes()).not.toContain('cwa:bottom-full')
    expect(clear!.classes()).toContain('cwa:bottom-full')
    expect(clear!.classes()).not.toContain('cwa:top-0')
  })

  test('moving the pointer within the same outlined component measures nothing again', async () => {
    vi.useFakeTimers()
    const { cwa } = mockCwa()
    const element = elementAt({ top: 300, left: 20, right: 120, bottom: 360 })
    const [first, second] = [document.createElement('span'), document.createElement('span')]
    element.append(first, second)
    register(cwa, COMPONENT, [element])
    arrive(ids[0]!, SAM, { component: COMPONENT })
    await mountOutlines()
    vi.advanceTimersByTime(3000)
    await nextTick()
    first.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
    await nextTick()
    const measured = vi.mocked(element.getBoundingClientRect).mock.calls.length

    second.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
    await nextTick()

    expect(vi.mocked(element.getBoundingClientRect).mock.calls.length).toBe(measured)
  })

  test('someone with no name is called "Someone"', async () => {
    const { cwa } = mockCwa()
    register(cwa, COMPONENT, [elementAt({ top: 10, left: 20, right: 120, bottom: 60 })])
    arrive(ids[0]!, { id: '/users/anon' }, { component: COMPONENT })

    const wrapper = await mountOutlines()

    expect(flags(wrapper).map(flag => flag.text())).toStrictEqual(['Someone'])
  })

  test('the name flag fades after 3 seconds without a change in that peer\'s presence, and shows again when it changes', async () => {
    vi.useFakeTimers()
    const { cwa } = mockCwa()
    register(cwa, COMPONENT, [elementAt({ top: 10, left: 20, right: 120, bottom: 60 })])
    arrive(ids[0]!, SAM, { component: COMPONENT })
    const wrapper = await mountOutlines()
    expect(flags(wrapper)[0]!.attributes('data-faded')).toBeUndefined()

    vi.advanceTimersByTime(3000)
    await nextTick()
    expect(flags(wrapper)[0]!.attributes('data-faded')).toBe('true')

    arrive(ids[0]!, SAM, { component: COMPONENT })
    await nextTick()
    expect(flags(wrapper)[0]!.attributes('data-faded')).toBe('true')

    arrive(ids[0]!, SAM, { state: 'editing', component: COMPONENT, field: 'html' })
    await nextTick()
    expect(flags(wrapper)[0]!.attributes('data-faded')).toBeUndefined()
  })

  test('a faded flag shows again while the pointer is over the outlined component, without blocking clicks', async () => {
    vi.useFakeTimers()
    const { cwa } = mockCwa()
    const element = elementAt({ top: 10, left: 20, right: 120, bottom: 60 })
    const child = document.createElement('span')
    element.appendChild(child)
    register(cwa, COMPONENT, [element])
    arrive(ids[0]!, SAM, { component: COMPONENT })
    const wrapper = await mountOutlines()
    vi.advanceTimersByTime(3000)
    await nextTick()

    child.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
    await nextTick()
    expect(flags(wrapper)[0]!.attributes('data-faded')).toBeUndefined()

    document.body.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
    await nextTick()
    expect(flags(wrapper)[0]!.attributes('data-faded')).toBe('true')
    expect(outlines(wrapper)[0]!.classes()).toContain('cwa:pointer-events-none')
  })

  test('sits below this admin\'s own selection outline and is drawn apart from it', async () => {
    const { cwa } = mockCwa()
    register(cwa, COMPONENT, [elementAt({ top: 10, left: 20, right: 120, bottom: 60 })])
    arrive(ids[0]!, SAM, { component: COMPONENT })

    const wrapper = await mountOutlines()

    const classes = outlines(wrapper)[0]!.classes()
    expect(classes).toContain('cwa:z-peer-outline')
    expect(classes).not.toContain('cwa:z-manager-focus')
    expect(classes).not.toContain('cwa:outline-offset-4')
  })

  test('skips a copy whose elements have left the page', async () => {
    const { cwa } = mockCwa()
    const detached = elementAt({ top: 10, left: 20, right: 120, bottom: 60 })
    detached.remove()
    register(cwa, COMPONENT, [detached])
    arrive(ids[0]!, SAM, { component: COMPONENT })

    const wrapper = await mountOutlines()

    expect(outlines(wrapper)).toHaveLength(0)
  })

  test('draws a copy that mounts later, and drops the outline when the peer moves on', async () => {
    const { cwa } = mockCwa()
    arrive(ids[0]!, SAM, { component: COMPONENT })
    const wrapper = await mountOutlines()
    expect(outlines(wrapper)).toHaveLength(0)

    register(cwa, COMPONENT, [elementAt({ top: 10, left: 20, right: 120, bottom: 60 })])
    await nextTick()
    expect(outlines(wrapper)).toHaveLength(1)

    arrive(ids[0]!, SAM, { state: 'viewing' })
    await nextTick()
    expect(outlines(wrapper)).toHaveLength(0)
  })

  test.each(['redrawFocus', 'resize', 'scroll', 'page'])('redraws on %s', async (trigger) => {
    const { cwa, emit, state } = mockCwa()
    const element = elementAt({ top: 10, left: 20, right: 120, bottom: 60 })
    register(cwa, COMPONENT, [element])
    arrive(ids[0]!, SAM, { component: COMPONENT })
    const wrapper = await mountOutlines()
    element.getBoundingClientRect = vi.fn(() => ({ top: 400, left: 20, right: 120, bottom: 460 }) as DOMRect)

    if (trigger === 'redrawFocus') {
      emit('redrawFocus')
    }
    else if (trigger === 'page') {
      state.loading = true
    }
    else {
      window.dispatchEvent(new Event(trigger))
    }
    await nextTick()

    expect(outlines(wrapper)[0]!.attributes('style')).toContain('top: 400px')
  })

  test('redraws when an outlined component or the page changes size, as a component that fills in after its outline was drawn', async () => {
    const observers: { callback: () => void, observed: Element[], disconnect: ReturnType<typeof vi.fn> }[] = []
    vi.stubGlobal('ResizeObserver', class {
      observed: Element[] = []
      disconnect = vi.fn()
      constructor(public callback: () => void) {
        observers.push(this)
      }

      observe(element: Element) {
        this.observed.push(element)
      }
    })
    const { cwa } = mockCwa()
    const element = elementAt({ top: 10, left: 20, right: 120, bottom: 10 })
    register(cwa, COMPONENT, [element])
    arrive(ids[0]!, SAM, { component: COMPONENT })
    const wrapper = await mountOutlines()
    expect(observers[0]!.observed).toEqual(expect.arrayContaining([element, document.body]))

    element.getBoundingClientRect = vi.fn(() => ({ top: 38, left: 20, right: 120, bottom: 66 }) as DOMRect)
    observers[0]!.callback()
    await nextTick()

    expect(outlines(wrapper)[0]!.attributes('style')).toContain('top: 38px')
    wrapper.unmount()
    expect(observers[0]!.disconnect).toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  test('stops listening once unmounted', async () => {
    const { cwa } = mockCwa()
    const removeSpy = vi.spyOn(window, 'removeEventListener')
    const documentRemoveSpy = vi.spyOn(document, 'removeEventListener')
    const wrapper = mount(PeerOutlines, { global: { stubs: { teleport: true } } })
    const [[, redrawHandler]] = vi.mocked(cwa.admin.eventBus.on).mock.calls as any

    wrapper.unmount()

    expect(cwa.admin.eventBus.off).toHaveBeenCalledWith('redrawFocus', redrawHandler)
    expect(removeSpy).toHaveBeenCalledWith('resize', redrawHandler)
    expect(removeSpy).toHaveBeenCalledWith('scroll', redrawHandler, true)
    expect(documentRemoveSpy).toHaveBeenCalledWith('mouseover', expect.any(Function))
  })
})
