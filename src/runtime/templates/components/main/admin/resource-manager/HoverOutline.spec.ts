// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { ref, shallowRef } from 'vue'
import type { Ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import HoverOutline from './HoverOutline.vue'
import * as cwaComposable from '#cwa/composables/cwa'
import { registerInstance, unregisterInstance } from '#cwa/admin/manageable-instances'
import { useCloneMode } from '#cwa/admin/clone-mode'
import type Cwa from '#cwa/cwa'

const appContainer = vi.hoisted(() => ({ element: undefined as HTMLElement | undefined }))

vi.mock('#app/nuxt', async importOriginal => ({
  ...await importOriginal<typeof import('#app/nuxt')>(),
  useNuxtApp: () => ({ vueApp: { _container: appContainer.element } }),
}))

const COMPONENT = '/component/html_contents/c1'
const INNER = '/component/html_contents/inner'
const POSITION = '/_/component_positions/p1'

const mounted: { unmount: () => void }[] = []
const registered: Array<[Cwa, string, Ref<HTMLElement[]>]> = []

function mockCwa() {
  const currentStackItem = shallowRef<{ domElements: Ref<HTMLElement[]> } | undefined>()
  const cwa = {
    auth: { user: { '@id': '/_/users/admin' } },
    resources: { findAllPublishableIris: (iri: string) => [iri] },
    admin: {
      isEditing: true,
      resourceStackManager: { currentStackItem },
      eventBus: { on: vi.fn(), off: vi.fn() },
    },
  }
  vi.spyOn(cwaComposable, 'useCwa').mockReturnValue(cwa as unknown as Cwa)
  return { cwa: cwa as unknown as Cwa, currentStackItem }
}

function elementAt(rect: { top: number, left: number, right: number, bottom: number }, parent: HTMLElement = document.body) {
  const element = document.createElement('div')
  element.getBoundingClientRect = vi.fn(() => ({ ...rect, width: rect.right - rect.left, height: rect.bottom - rect.top }) as DOMRect)
  parent.appendChild(element)
  return element
}

function register(cwa: Cwa, iri: string, element: HTMLElement) {
  const elements = ref([element])
  registerInstance(cwa, iri, elements)
  registered.push([cwa, iri, elements])
  return elements
}

function setPointer(hovers: boolean) {
  window.matchMedia = vi.fn((query: string) => ({ matches: hovers && query === '(hover: hover) and (pointer: fine)' }) as MediaQueryList)
}

async function hover(target: EventTarget) {
  target.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
  await flushPromises()
}

function outlines() {
  return [...document.querySelectorAll<HTMLElement>('[data-testid="hover-outline"]')]
}

async function mountOutline() {
  const wrapper = mount(HoverOutline)
  mounted.push(wrapper)
  await flushPromises()
  return wrapper
}

describe('HoverOutline', () => {
  const originalMatchMedia = window.matchMedia

  beforeEach(() => {
    setPointer(true)
  })

  afterEach(() => {
    mounted.splice(0).forEach(wrapper => wrapper.unmount())
    registered.splice(0).forEach(([cwa, iri, elements]) => unregisterInstance(cwa, iri, elements))
    window.matchMedia = originalMatchMedia
    appContainer.element = undefined
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  test('outlines the innermost component under a fine pointer, thinly, fading in, below the selection\'s layer, in the app\'s container', async () => {
    const { cwa } = mockCwa()
    appContainer.element = document.createElement('div')
    document.body.appendChild(appContainer.element)
    const position = elementAt({ top: 0, left: 0, right: 400, bottom: 300 })
    const outer = elementAt({ top: 10, left: 10, right: 390, bottom: 290 }, position)
    const inner = elementAt({ top: 40, left: 20, right: 120, bottom: 80 }, outer)
    const text = document.createElement('span')
    inner.appendChild(text)
    register(cwa, POSITION, position)
    register(cwa, COMPONENT, outer)
    register(cwa, INNER, inner)
    await mountOutline()

    await hover(text)

    expect(outlines()).toHaveLength(1)
    const outline = outlines()[0]!
    expect(appContainer.element.contains(outline)).toBe(true)
    expect(outline.style.top).toBe('40px')
    expect(outline.style.left).toBe('20px')
    expect(outline.style.width).toBe('100px')
    expect(outline.classList).toContain('cwa:outline-1')
    expect(outline.classList).toContain('cwa:outline-accent-fg/40')
    expect(outline.classList).toContain('cwa:z-peer-outline')
    expect(outline.classList).toContain('cwa:pointer-events-none')
    expect(outline.classList).toContain('cwa:motion-safe:animate-[cwa-line-in_150ms_ease-out]')
  })

  test('moving to another component draws a fresh outline, so it fades in again, and moving off every component removes it', async () => {
    const { cwa } = mockCwa()
    const first = elementAt({ top: 0, left: 0, right: 100, bottom: 50 })
    const second = elementAt({ top: 60, left: 0, right: 100, bottom: 110 })
    const empty = elementAt({ top: 200, left: 0, right: 100, bottom: 250 })
    register(cwa, COMPONENT, first)
    register(cwa, INNER, second)
    await mountOutline()

    await hover(first)
    const drawn = outlines()[0]
    await hover(second)
    expect(outlines()).toHaveLength(1)
    expect(outlines()[0]).not.toBe(drawn)
    expect(outlines()[0]!.style.top).toBe('60px')

    await hover(empty)
    expect(outlines()).toHaveLength(0)
  })

  test('the outlined component is marked for the crosshair cursor while, and only while, its outline is drawn, and unmounting clears the mark', async () => {
    const { cwa, currentStackItem } = mockCwa()
    const first = elementAt({ top: 0, left: 0, right: 100, bottom: 50 })
    const second = elementAt({ top: 60, left: 0, right: 100, bottom: 110 })
    const empty = elementAt({ top: 200, left: 0, right: 100, bottom: 250 })
    register(cwa, COMPONENT, first)
    const secondElements = register(cwa, INNER, second)
    const wrapper = await mountOutline()
    const marked = () => [first, second].filter(element => element.hasAttribute('data-cwa-hovered'))

    await hover(first)
    expect(marked()).toEqual([first])

    await hover(second)
    expect(marked()).toEqual([second])

    currentStackItem.value = { domElements: secondElements }
    await flushPromises()
    expect(outlines()).toHaveLength(0)
    expect(marked()).toEqual([])

    currentStackItem.value = undefined
    await flushPromises()
    expect(marked()).toEqual([second])

    await hover(empty)
    expect(marked()).toEqual([])

    await hover(first)
    wrapper.unmount()
    expect(marked()).toEqual([])
  })

  test('a position or group alone under the pointer is not outlined', async () => {
    const { cwa } = mockCwa()
    const position = elementAt({ top: 0, left: 0, right: 100, bottom: 50 })
    register(cwa, POSITION, position)
    await mountOutline()

    await hover(position)

    expect(outlines()).toHaveLength(0)
  })

  test('the selected component is not outlined again', async () => {
    const { cwa, currentStackItem } = mockCwa()
    const element = elementAt({ top: 0, left: 0, right: 100, bottom: 50 })
    const elements = register(cwa, COMPONENT, element)
    currentStackItem.value = { domElements: elements }
    await mountOutline()

    await hover(element)

    expect(outlines()).toHaveLength(0)
  })

  test('clone mode\'s outlined target is not outlined again', async () => {
    const { cwa } = mockCwa()
    const element = elementAt({ top: 0, left: 0, right: 100, bottom: 50 })
    register(cwa, COMPONENT, element)
    const cloneMode = useCloneMode(cwa)
    cloneMode.setTarget([element])
    await mountOutline()

    await hover(element)
    expect(outlines()).toHaveLength(0)

    cloneMode.setTarget()
    await flushPromises()
    expect(outlines()).toHaveLength(1)
  })

  test('the pointer leaving the window removes the outline', async () => {
    const { cwa } = mockCwa()
    const element = elementAt({ top: 0, left: 0, right: 100, bottom: 50 })
    register(cwa, COMPONENT, element)
    await mountOutline()
    await hover(element)

    element.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: null }))
    await flushPromises()

    expect(outlines()).toHaveLength(0)
  })

  test('on a touch screen, with no hover or no fine pointer, nothing is drawn', async () => {
    setPointer(false)
    const { cwa } = mockCwa()
    const element = elementAt({ top: 0, left: 0, right: 100, bottom: 50 })
    register(cwa, COMPONENT, element)
    await mountOutline()

    await hover(element)

    expect(outlines()).toHaveLength(0)
    expect(element.hasAttribute('data-cwa-hovered')).toBe(false)
  })
})
