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

vi.mock('#build/cwa-config', () => ({ resourcesConfig: { HtmlContent: { name: 'Rich text' } } }))

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

function grips() {
  return [...document.querySelectorAll<HTMLElement>('[data-testid="reorder-grip"]')]
}

function lines() {
  return [...document.querySelectorAll<HTMLElement>('[data-testid="reorder-drop-line"]')]
}

function ghost() {
  return document.querySelector<HTMLElement>('[data-testid="reorder-ghost"]')
}

function pointer(type: string, y: number, button = 0) {
  return new PointerEvent(type, { bubbles: true, cancelable: true, clientX: 10, clientY: y, pointerId: 1, button })
}

function compiledCss() {
  return postcss.parse(readFileSync(resolve(import.meta.dirname, '../../../../assets/cwa.css'), 'utf8'))
}

afterEach(async () => {
  registered.splice(0).forEach(([cwa, iri, elements]) => unregisterInstance(cwa, iri, elements))
  await new Promise(resolve => setTimeout(resolve, 0))
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('ReorderHandles', () => {
  test('marks every position of the group as draggable and shows a small decorative grip in its top right corner, in the app\'s container and never in the tab order', async () => {
    const { elements } = setup()
    mount(ReorderHandles, { props: { groupIri: GROUP } })
    await flushPromises()
    expect(Object.values(elements).every(element => element.hasAttribute('data-cwa-reorderable'))).toBe(true)
    const shown = grips()
    expect(shown).toHaveLength(3)
    expect(shown.every(grip => appContainer.element!.contains(grip))).toBe(true)
    expect(shown.every(grip => grip.getAttribute('aria-hidden') === 'true' && grip.tagName === 'DIV' && !grip.hasAttribute('tabindex'))).toBe(true)
    expect(shown.every(grip => grip.className.includes('cwa:pointer-events-none'))).toBe(true)
    expect(shown.map(grip => [grip.style.top, grip.style.left])).toEqual([['0px', '400px'], ['100px', '400px'], ['200px', '400px']])
  })

  test('a press anywhere inside a component, dragged, shows one drop line where it will land and a ghost of its box, moving nothing in the page, and the drop emits the reorder the Order tab uses', async () => {
    const { reorder, elements } = setup()
    const inner = elements[A]!.appendChild(document.createElement('p'))
    mount(ReorderHandles, { props: { groupIri: GROUP } })
    await flushPromises()
    inner.dispatchEvent(pointer('pointerdown', 50))
    document.body.dispatchEvent(pointer('pointermove', 260))
    await flushPromises()
    expect(lines()).toHaveLength(1)
    expect(lines()[0]!.style.top).toBe('300px')
    expect([ghost()?.style.top, ghost()?.style.height]).toEqual(['210px', '100px'])
    expect(Object.values(elements).map(element => element.getAttribute('style'))).toEqual([null, null, null])
    expect(elements[A]!.hasAttribute('data-cwa-reorder-held')).toBe(true)
    document.body.dispatchEvent(pointer('pointerup', 260))
    await flushPromises()
    expect(reorder).toHaveBeenCalledOnce()
    expect(reorder).toHaveBeenCalledWith({ positionIri: A, location: 3 })
    expect(lines()).toEqual([])
    expect(ghost()).toBeNull()
    expect(elements[A]!.hasAttribute('data-cwa-reorder-held')).toBe(false)
  })

  test('over its own place there is a ghost but no drop line', async () => {
    const { elements } = setup()
    mount(ReorderHandles, { props: { groupIri: GROUP } })
    await flushPromises()
    elements[B]!.dispatchEvent(pointer('pointerdown', 150))
    document.body.dispatchEvent(pointer('pointermove', 130))
    await flushPromises()
    expect(ghost()).not.toBeNull()
    expect(lines()).toEqual([])
  })

  test.each([
    ['outside every position', () => document.body],
    ['in a field inside a component', (elements: Record<string, HTMLElement>) => elements[A]!.appendChild(document.createElement('input'))],
    ['with the right button', (elements: Record<string, HTMLElement>) => elements[A]!],
  ])('a press %s starts no drag', async (label, target) => {
    const { reorder, elements } = setup()
    mount(ReorderHandles, { props: { groupIri: GROUP } })
    await flushPromises()
    target(elements).dispatchEvent(pointer('pointerdown', 50, label === 'with the right button' ? 2 : 0))
    document.body.dispatchEvent(pointer('pointermove', 260))
    document.body.dispatchEvent(pointer('pointerup', 260))
    await flushPromises()
    expect(ghost()).toBeNull()
    expect(reorder).not.toHaveBeenCalled()
  })

  test('a click under the threshold on a link inside a component reaches the link, and only the click ending a drag is swallowed', async () => {
    const { elements } = setup()
    const link = elements[A]!.appendChild(document.createElement('a'))
    link.href = '/second'
    const pageClick = vi.fn()
    document.addEventListener('click', pageClick)
    mount(ReorderHandles, { props: { groupIri: GROUP } })
    await flushPromises()

    link.dispatchEvent(pointer('pointerdown', 50))
    link.dispatchEvent(pointer('pointerup', 50))
    const pressed = new MouseEvent('click', { bubbles: true, cancelable: true })
    link.dispatchEvent(pressed)

    link.dispatchEvent(pointer('pointerdown', 50))
    document.body.dispatchEvent(pointer('pointermove', 260))
    document.body.dispatchEvent(pointer('pointerup', 260))
    const dragged = new MouseEvent('click', { bubbles: true, cancelable: true })
    link.dispatchEvent(dragged)

    document.removeEventListener('click', pageClick)
    expect(pressed.defaultPrevented).toBe(false)
    expect(dragged.defaultPrevented).toBe(true)
    expect(pageClick).toHaveBeenCalledOnce()
    expect(pageClick.mock.calls[0]![0]).toBe(pressed)
  })

  test('unmounting (the group no longer selected) mid-drag removes the grips, the line, the ghost, the marks and every listener', async () => {
    const { reorder, elements } = setup()
    const wrapper = mount(ReorderHandles, { props: { groupIri: GROUP } })
    await flushPromises()
    elements[A]!.dispatchEvent(pointer('pointerdown', 50))
    document.body.dispatchEvent(pointer('pointermove', 260))
    await flushPromises()
    wrapper.unmount()
    document.body.dispatchEvent(pointer('pointerup', 260))
    elements[B]!.dispatchEvent(pointer('pointerdown', 150))
    document.body.dispatchEvent(pointer('pointermove', 20))
    document.body.dispatchEvent(pointer('pointerup', 20))
    expect(reorder).not.toHaveBeenCalled()
    expect(grips()).toEqual([])
    expect(lines()).toEqual([])
    expect(ghost()).toBeNull()
    expect(Object.values(elements).some(element => element.hasAttribute('data-cwa-reorderable') || element.hasAttribute('data-cwa-reorder-held'))).toBe(false)
  })

  test('the compiled CSS gives a draggable component a grab cursor over everything in it (a link\'s crosshair included), no text selection or touch scroll, and grabbing while held', () => {
    const css = compiledCss()
    const declarations = (selector: string) => {
      const found: Record<string, string> = {}
      css.walkRules((rule: Rule) => {
        if (rule.selectors.includes(selector)) {
          rule.walkDecls((decl) => {
            found[decl.prop] = `${decl.value}${decl.important ? ' !important' : ''}`
          })
        }
      })
      return found
    }
    expect(declarations('[data-cwa-reorderable]')).toMatchObject({ 'cursor': 'grab !important', 'touch-action': 'none', 'user-select': 'none' })
    expect(declarations('[data-cwa-reorderable] *').cursor).toBe('grab !important')
    expect(declarations('[data-cwa-reorder-held] *').cursor).toBe('grabbing !important')
    expect(declarations('[data-cwa-reorder-held]').cursor).toBe('grabbing !important')
  })

  test('nothing wobbles: the compiled CSS has no wobble animation left', () => {
    const css = compiledCss()
    const names: string[] = []
    css.walkAtRules('keyframes', rule => names.push((rule as any).params))
    css.walkRules((rule: Rule) => names.push(...rule.selectors))
    expect(names.filter(name => /wobble|is-reordering/.test(name))).toEqual([])
  })
})
