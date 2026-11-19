// @vitest-environment happy-dom
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import postcss from 'postcss'
import type { Rule } from 'postcss'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { computed, reactive, ref } from 'vue'
import type { Ref } from 'vue'
import mitt from 'mitt'
import { flushPromises, mount } from '@vue/test-utils'
import ReorderHandles from './ReorderHandles.vue'
import * as cwaComposable from '#cwa/composables/cwa'
import { registerInstance, unregisterInstance } from '#cwa/admin/manageable-instances'
import type Cwa from '#cwa/cwa'

const appContainer = vi.hoisted(() => ({ element: undefined as HTMLElement | undefined }))

vi.mock('#app/nuxt', async importOriginal => ({
  ...await importOriginal<typeof import('#app/nuxt')>(),
  useNuxtApp: () => ({ vueApp: { _container: appContainer.element } }),
}))

const GROUP = '/_/component_groups/g'
const A = '/_/component_positions/a'
const B = '/_/component_positions/b'
const C = '/_/component_positions/c'

function elementAt(top: number) {
  const element = document.createElement('div')
  element.getBoundingClientRect = vi.fn(() => ({ top, bottom: top + 100, left: 0, right: 400, width: 400, height: 100 }) as DOMRect)
  document.body.appendChild(element)
  return element
}

const registered: Array<[Cwa, string, Ref<HTMLElement[]>]> = []

function setup() {
  appContainer.element = document.createElement('div')
  document.body.appendChild(appContainer.element)
  const state = reactive({ order: [A, B, C] })
  const eventBus = mitt<any>()
  const reorder = vi.fn()
  eventBus.on('reorder', reorder)
  const cwa = {
    admin: { eventBus },
    resourcesConfig: { HtmlContent: { name: 'Rich text' } },
    resources: {
      getOrderedPositionsForGroup: vi.fn(() => state.order),
      positionComponentIri: vi.fn((iri: string) => computed(() => iri.replace('component_positions', 'component'))),
      getResource: vi.fn((iri: string) => computed(() => ({ data: { '@id': iri, '@type': 'HtmlContent' } }))),
      findAllPublishableIris: vi.fn((iri: string) => [iri]),
      displayPageIri: ref('/_/pages/home'),
      isLoading: ref(false),
    },
  } as unknown as Cwa
  vi.spyOn(cwaComposable, 'useCwa').mockReturnValue(cwa)
  const elements = Object.fromEntries([A, B, C].map((iri, index) => {
    const instance = ref([elementAt(index * 100)])
    registerInstance(cwa, iri, instance)
    registered.push([cwa, iri, instance])
    return [iri, instance.value[0]!]
  }))
  return { cwa, state, reorder, elements }
}

function handles() {
  return [...document.querySelectorAll<HTMLElement>('[data-testid="reorder-handle"]')]
}

function pointer(type: string, y: number) {
  return new PointerEvent(type, { bubbles: true, cancelable: true, clientX: 10, clientY: y, pointerId: 1 })
}

afterEach(async () => {
  registered.splice(0).forEach(([cwa, iri, elements]) => unregisterInstance(cwa, iri, elements))
  await new Promise(resolve => setTimeout(resolve, 0))
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('ReorderHandles', () => {
  test('shows a grip handle on every position in the group, in the app\'s container, named for its component and out of the tab order', async () => {
    setup()
    mount(ReorderHandles, { props: { groupIri: GROUP } })
    await flushPromises()
    const shown = handles()
    expect(shown).toHaveLength(3)
    expect(shown.every(handle => appContainer.element!.contains(handle))).toBe(true)
    expect(shown[0]!.getAttribute('aria-label')).toBe('Drag to reorder Rich text')
    expect(shown[0]!.getAttribute('tabindex')).toBe('-1')
    expect(shown.map(handle => handle.style.top)).toEqual(['0px', '100px', '200px'])
  })

  test('the positions wobble, alternating, and the one held stops wobbling until it is dropped', async () => {
    const { elements } = setup()
    mount(ReorderHandles, { props: { groupIri: GROUP } })
    await flushPromises()
    expect(elements[A]!.classList.contains('cwa:reorder-wobble')).toBe(true)
    expect(elements[B]!.classList.contains('cwa:reorder-wobble-alt')).toBe(true)
    expect(elements[C]!.classList.contains('cwa:reorder-wobble')).toBe(true)
    handles()[1]!.dispatchEvent(pointer('pointerdown', 150))
    await flushPromises()
    expect(elements[B]!.className).not.toContain('wobble')
    expect(elements[A]!.classList.contains('cwa:reorder-wobble')).toBe(true)
    handles()[1]!.dispatchEvent(pointer('pointerup', 150))
    await flushPromises()
    expect(elements[B]!.classList.contains('cwa:reorder-wobble-alt')).toBe(true)
  })

  test('dragging a handle shows the drop line and a drop emits the reorder the Order tab uses', async () => {
    const { reorder } = setup()
    mount(ReorderHandles, { props: { groupIri: GROUP } })
    await flushPromises()
    const handle = handles()[0]!
    handle.dispatchEvent(pointer('pointerdown', 50))
    handle.dispatchEvent(pointer('pointermove', 260))
    await flushPromises()
    expect(document.querySelector<HTMLElement>('[data-testid="reorder-drop-line"]')?.style.top).toBe('300px')
    handle.dispatchEvent(pointer('pointerup', 260))
    await flushPromises()
    expect(reorder).toHaveBeenCalledOnce()
    expect(reorder).toHaveBeenCalledWith({ positionIri: A, location: 3 })
    expect(document.querySelector('[data-testid="reorder-drop-line"]')).toBeNull()
  })

  test('unmounting (reordering turned off) mid-drag removes the handles, the line, the wobble and every listener', async () => {
    const { reorder, elements } = setup()
    const wrapper = mount(ReorderHandles, { props: { groupIri: GROUP } })
    await flushPromises()
    const handle = handles()[0]!
    handle.dispatchEvent(pointer('pointerdown', 50))
    handle.dispatchEvent(pointer('pointermove', 260))
    await flushPromises()
    wrapper.unmount()
    handle.dispatchEvent(pointer('pointerup', 260))
    expect(reorder).not.toHaveBeenCalled()
    expect(handles()).toEqual([])
    expect(document.querySelector('[data-testid="reorder-drop-line"]')).toBeNull()
    expect(Object.values(elements).some(element => element.className.includes('wobble'))).toBe(false)
  })

  test('a click on a grip over a component holding a link, pressed or dragged, never reaches the page, so the link menu does not open', async () => {
    const { elements } = setup()
    const link = document.createElement('a')
    link.href = '/second'
    elements[A]!.appendChild(link)
    const pageClick = vi.fn()
    document.addEventListener('click', pageClick)
    mount(ReorderHandles, { props: { groupIri: GROUP } })
    await flushPromises()
    const handle = handles()[0]!

    handle.dispatchEvent(pointer('pointerdown', 50))
    handle.dispatchEvent(pointer('pointerup', 50))
    const pressed = new MouseEvent('click', { bubbles: true, cancelable: true })
    handle.dispatchEvent(pressed)

    handle.dispatchEvent(pointer('pointerdown', 50))
    handle.dispatchEvent(pointer('pointermove', 260))
    handle.dispatchEvent(pointer('pointerup', 260))
    const dragged = new MouseEvent('click', { bubbles: true, cancelable: true })
    handle.dispatchEvent(dragged)

    document.removeEventListener('click', pageClick)
    expect(handle.contains(link)).toBe(false)
    expect(handle.closest('a[href]')).toBeNull()
    expect(pressed.defaultPrevented).toBe(true)
    expect(dragged.defaultPrevented).toBe(true)
    expect(pageClick).not.toHaveBeenCalled()
  })

  test('the wobble rocks gently in the compiled CSS, without touching an app\'s own transform, and stops when the system asks for reduced motion', () => {
    const css = postcss.parse(readFileSync(resolve(import.meta.dirname, '../../../../assets/cwa.css'), 'utf8'))
    const declarations = (selector: string, inReduce: boolean) => {
      const found: Record<string, string> = {}
      css.walkRules((rule: Rule) => {
        const reduce = rule.parent?.type === 'atrule' && /prefers-reduced-motion: reduce/.test((rule.parent as any).params)
        if (reduce === inReduce && rule.selectors.includes(selector)) {
          rule.walkDecls((decl) => {
            found[decl.prop] = decl.value
          })
        }
      })
      return found
    }
    const keyframes: string[] = []
    css.walkAtRules('keyframes', rule => rule.walkDecls(decl => keyframes.push(`${(rule as any).params} ${decl.prop}: ${decl.value}`)))
    for (const [selector, name] of [['.cwa\\:reorder-wobble', 'cwa-reorder-wobble'], ['.cwa\\:reorder-wobble-alt', 'cwa-reorder-wobble-alt']] as const) {
      expect(declarations(selector, false).animation).toBe(`${name} 0.5s infinite`)
      expect(declarations(selector, true).animation).toBe('none')
      const props = keyframes.filter(line => line.startsWith(`${name} `)).map(line => line.split(' ')[1])
      expect(props).toContain('rotate:')
      expect(props).not.toContain('transform:')
    }
  })
})
