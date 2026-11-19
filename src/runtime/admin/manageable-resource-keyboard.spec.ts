// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from 'vitest'
import { defineComponent, h, nextTick, reactive, ref } from 'vue'
import type { ComponentPublicInstance } from 'vue'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import ManageableResource from './manageable-resource'
import type Cwa from '../cwa'

vi.mock('./manageable-instances', () => ({ registerInstance: vi.fn(), unregisterInstance: vi.fn() }))
vi.mock('#build/cwa-config', () => ({ resourcesConfig: { HtmlContent: { name: 'Body Text' }, Title: { name: 'Title' } } }))
vi.mock('./manager-tabs-resolver', () => ({
  default: vi.fn(function () {
    return { resolve: () => [] }
  }),
}))

enableAutoUnmount(afterEach)

function setup(options: { editing?: boolean, tag?: string, attrs?: Record<string, string>, disabled?: boolean, iri?: string } = {}) {
  const admin = reactive({ isEditing: options.editing ?? true })
  const type = ref('HtmlContent')
  const addToStack = vi.fn()
  let moduleSelect = false
  const selections: boolean[] = []
  const $cwa = {
    admin: Object.assign(admin, {
      eventBus: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
      resourceStackManager: {
        addToStack: (...args: unknown[]) => {
          selections.push(moduleSelect)
          addToStack(...args)
        },
        selectFromModule: (dispatch: () => void) => {
          moduleSelect = true
          dispatch()
          moduleSelect = false
        },
      },
    }),
    resources: {
      getResource: () => ({ get value() {
        return { data: { '@id': '/component/body', '@type': type.value } }
      } }),
      getChildIris: () => [],
      findAllPublishableIris: (iri: string) => [iri],
      positionComponentIri: () => ({ value: undefined }),
    },
    resourcesManager: { addResourceEvent: ref() },
  } as unknown as Cwa
  const ops = ref({ disabled: options.disabled })
  let manageable: ManageableResource | undefined
  const wrapper = mount(defineComponent({
    setup() {
      return () => h(options.tag ?? 'div', { ...options.attrs }, [h('p', 'Hello'), h('button', { type: 'button' }, 'Title')])
    },
    mounted() {
      manageable = new ManageableResource(this as ComponentPublicInstance, $cwa, ops)
      manageable.init(ref(options.iri ?? '/component/body'))
    },
  }), { attachTo: document.body })
  const contextMenus: MouseEvent[] = []
  wrapper.element.addEventListener('contextmenu', (event: Event) => contextMenus.push(event as MouseEvent))
  const clicks: Event[] = []
  wrapper.element.addEventListener('click', (event: Event) => clicks.push(event))
  return { wrapper, admin, type, addToStack, selections, ops, contextMenus, clicks, manageable: () => manageable! }
}

const key = (target: Element, init: KeyboardEventInit) => {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init })
  target.dispatchEvent(event)
  return event
}

describe('ManageableResource keyboard access (#461)', () => {
  test('in edit mode a component\'s element is a tab stop named for it; outside edit mode it has nothing added', async () => {
    const { wrapper, admin } = setup({ editing: false })
    await nextTick()
    const el = wrapper.element as HTMLElement
    expect(['tabindex', 'aria-label', 'role'].map(attribute => el.hasAttribute(attribute))).toEqual([false, false, false])

    admin.isEditing = true
    await nextTick()
    expect(el.getAttribute('tabindex')).toBe('0')
    expect(el.getAttribute('aria-label')).toBe('Body Text component')
    expect(el.getAttribute('role')).toBe('group')

    admin.isEditing = false
    await nextTick()
    expect(['tabindex', 'aria-label', 'role'].map(attribute => el.hasAttribute(attribute))).toEqual([false, false, false])
  })

  test('the name follows the resource it shows', async () => {
    const { wrapper, type } = setup()
    await nextTick()

    type.value = 'Title'
    await nextTick()

    expect(wrapper.element.getAttribute('aria-label')).toBe('Title component')
  })

  test('only a component is a tab stop: never its position or group, which share its element, nor an element already focusable such as a link', async () => {
    const position = setup({ iri: '/_/component_positions/1' })
    const group = setup({ iri: '/_/component_groups/1' })
    const link = setup({ tag: 'a', attrs: { href: '/kitchens' } })
    const placeholder = setup({ iri: '__new__' })
    await nextTick()

    expect(position.wrapper.element.hasAttribute('tabindex')).toBe(false)
    expect(position.wrapper.element.hasAttribute('aria-label')).toBe(false)
    expect(group.wrapper.element.hasAttribute('tabindex')).toBe(false)
    expect([link.wrapper.element.hasAttribute('tabindex'), link.wrapper.element.hasAttribute('aria-label')]).toEqual([false, false])
    expect(key(link.wrapper.element, { key: 'Enter' }).defaultPrevented).toBe(false)
    expect(placeholder.wrapper.element.getAttribute('tabindex')).toBe('0')
  })

  test('clearing the resource takes away what it added', async () => {
    const { wrapper, manageable } = setup()
    await nextTick()
    const el = wrapper.element as HTMLElement
    expect(el.getAttribute('tabindex')).toBe('0')

    manageable().clear()

    expect(['tabindex', 'aria-label', 'role'].map(attribute => el.hasAttribute(attribute))).toEqual([false, false, false])
  })

  test('an element with its own role, tabindex or name keeps them, and a disabled resource is never a tab stop', async () => {
    const own = setup({ tag: 'article', attrs: { 'tabindex': '-1', 'aria-label': 'Story' } })
    const disabled = setup({ disabled: true })
    await nextTick()
    const el = own.wrapper.element as HTMLElement

    expect([el.getAttribute('tabindex'), el.getAttribute('aria-label'), el.hasAttribute('role')]).toEqual(['-1', 'Story', false])
    expect(disabled.wrapper.element.hasAttribute('tabindex')).toBe(false)

    own.manageable().clear()
    expect([el.getAttribute('tabindex'), el.getAttribute('aria-label')]).toEqual(['-1', 'Story'])
  })

  test('Enter or Space on the component selects it through the click path, as a module select that a text selection never blocks', async () => {
    const { wrapper, addToStack, selections, clicks } = setup()
    await nextTick()
    const el = wrapper.element as HTMLElement

    const enter = key(el, { key: 'Enter' })
    expect(enter.defaultPrevented).toBe(true)
    expect(addToStack).toHaveBeenCalledTimes(1)
    expect(clicks).toHaveLength(1)
    expect(selections).toEqual([true])

    const space = key(el, { key: ' ' })
    expect(space.defaultPrevented).toBe(true)
    expect(addToStack).toHaveBeenCalledTimes(2)
  })

  test('keys typed inside the component, modified, composing or outside edit mode are left alone', async () => {
    const { wrapper, admin, addToStack } = setup()
    await nextTick()
    const el = wrapper.element as HTMLElement

    expect(key(el.querySelector('button')!, { key: 'Enter' }).defaultPrevented).toBe(false)
    expect(key(el.querySelector('p')!, { key: ' ' }).defaultPrevented).toBe(false)
    expect(key(el, { key: 'Enter', ctrlKey: true }).defaultPrevented).toBe(false)
    expect(key(el, { key: 'Enter', shiftKey: true }).defaultPrevented).toBe(false)
    expect(key(el, { key: 'Enter', isComposing: true }).defaultPrevented).toBe(false)
    expect(key(el, { key: 'a' }).defaultPrevented).toBe(false)

    admin.isEditing = false
    await nextTick()
    expect(key(el, { key: 'Enter' }).defaultPrevented).toBe(false)
    expect(key(el, { key: 'ContextMenu' }).defaultPrevented).toBe(false)
    expect(addToStack).not.toHaveBeenCalled()
  })

  test('Shift+F10 or the ContextMenu key opens the stack with a right-click inside the component', async () => {
    const { wrapper, contextMenus, addToStack } = setup()
    await nextTick()
    const el = wrapper.element as HTMLElement
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({ left: 100, top: 200, width: 300, height: 10, right: 400, bottom: 210, x: 100, y: 200, toJSON: () => ({}) })

    expect(key(el, { key: 'F10', shiftKey: true }).defaultPrevented).toBe(true)
    expect(key(el, { key: 'ContextMenu' }).defaultPrevented).toBe(true)
    expect(key(el, { key: 'F10' }).defaultPrevented).toBe(false)

    expect(contextMenus.map(event => [event.clientX, event.clientY, event.button])).toEqual([[116, 205, 2], [116, 205, 2]])
    expect(addToStack.mock.calls.map(call => call[1])).toEqual([true, true])
  })
})
