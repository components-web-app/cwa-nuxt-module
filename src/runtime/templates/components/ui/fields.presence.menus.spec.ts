// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { computed, defineComponent, h, reactive, ref } from 'vue'
import type { Component } from 'vue'
import MultiSelect from './MultiSelect.vue'
import ResourceSearch from './ResourceSearch.vue'
import DatePicker from './DatePicker.vue'
import Input from './Input.vue'
import Select from './Select.vue'
import { onPhone } from '../../../../../test/utils/sheet-media'
import { useCwaResourceModel } from '#cwa/composables/cwa-resource-model'

const store = vi.hoisted(() => ({ entry: undefined as any }))
const view = vi.hoisted(() => ({ focus: vi.fn(), blur: vi.fn(), peers: [] as unknown[] }))

vi.mock('#cwa/composables/cwa', async () => {
  const { computed } = await vi.importActual<typeof import('vue')>('vue')
  return {
    useCwa: () => ({
      resources: { getResource: () => computed(() => store.entry) },
      resourcesManager: {
        getWaitForRequestPromise: vi.fn().mockResolvedValue(undefined),
        updateResource: vi.fn(),
        registerPendingUpdate: vi.fn(() => () => {}),
      },
    }),
  }
})
vi.mock('#cwa/resources/model-editors', () => ({ registerModelEditor: vi.fn(() => () => {}), labelModelField: vi.fn(), modelFieldLabel: vi.fn() }))
vi.mock('#cwa/resources/realtime-view', () => ({
  realtimeView: () => ({
    view: { value: { focusedBy: () => view.peers } },
    load: () => Promise.resolve(view),
  }),
}))
vi.mock('#cwa/composables/cwa-resource-endpoint', () => ({ useCwaResourceEndpoint: () => ({ endpoint: computed(() => '/component/1') }) }))

enableAutoUnmount(afterEach)

interface MenuCase {
  name: string
  component: Component
  field: string
  stored: unknown
  props: Record<string, unknown>
  opener: string
  panel: string
  inside: string
}

const cases: MenuCase[] = [
  {
    name: 'CwaUiMultiSelect',
    component: MultiSelect,
    field: 'styles',
    stored: ['dark'],
    props: { options: [{ label: 'Dark', value: 'dark' }, { label: 'Padding', value: 'padding' }] },
    opener: '[data-testid="multi-input"]',
    panel: '[data-testid="multi-menu"]',
    inside: '[role="option"]',
  },
  {
    name: 'CwaUiResourceSearch',
    component: ResourceSearch,
    field: 'route',
    stored: null,
    props: { endpoint: '/_/routes', load: async () => ({ items: [{ '@id': '/_/routes/1', '@type': 'Route', 'path': '/one' }], total: 1 }) },
    opener: '[data-testid="search-input"]',
    panel: '[data-testid="search-menu"]',
    inside: '[role="option"]',
  },
  {
    name: 'CwaUiDatePicker',
    component: DatePicker,
    field: 'publishedAt',
    stored: null,
    props: {},
    opener: '[data-date-picker-trigger]',
    panel: '[role="dialog"]',
    inside: '[data-date]',
  },
]

function mountCase(item: MenuCase) {
  const Host = defineComponent({
    setup() {
      const model = useCwaResourceModel(ref('/component/1'), item.field, { debounceTime: 0 })
      return () => h(item.component, { label: 'Field', model, ...item.props })
    },
  })
  return mount(Host, { attachTo: document.body })
}

describe.each(cases)('$name presence with its menu open (#461)', (item) => {
  beforeEach(() => {
    store.entry = reactive({ data: { '@id': '/component/1', [item.field]: item.stored }, apiState: {} })
    view.focus.mockClear()
    view.blur.mockClear()
    view.peers = []
  })

  test('moving into the menu it opened never reports leaving the field; a pointerdown elsewhere does', async () => {
    const wrapper = mountCase(item)
    const opener = wrapper.get(item.opener)
    opener.element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    await opener.trigger('focusin')
    await opener.trigger('click')
    await flushPromises()
    const panel = document.querySelector<HTMLElement>(item.panel)!
    const inside = panel.querySelector<HTMLElement>(item.inside)!
    expect(wrapper.element.contains(panel)).toBe(false)

    opener.element.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: inside }))
    const activeElement = vi.spyOn(document, 'activeElement', 'get').mockReturnValue(document.body)
    inside.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    activeElement.mockRestore()
    await flushPromises()
    expect(view.focus).toHaveBeenCalled()
    expect(view.blur).not.toHaveBeenCalled()

    ;(document.activeElement as HTMLElement | null)?.blur()
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    await flushPromises()
    expect(view.blur).toHaveBeenCalledTimes(1)
  })

  test('by keyboard alone, moving into the menu is not leaving, and moving focus past it is (#476 review 4)', async () => {
    const wrapper = mountCase(item)
    const opener = wrapper.get(item.opener)
    await opener.trigger('focusin')
    await opener.trigger('click')
    await flushPromises()
    const panel = document.querySelector<HTMLElement>(item.panel)!
    const inside = panel.querySelector<HTMLElement>(item.inside)!
    const next = document.createElement('button')
    document.body.append(next)

    opener.element.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: inside }))
    inside.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    await flushPromises()
    expect(view.focus).toHaveBeenCalled()
    expect(view.blur).not.toHaveBeenCalled()

    next.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    await flushPromises()
    expect(view.blur).toHaveBeenCalledTimes(1)
    next.remove()
  })
})

interface SheetCase {
  name: string
  component: Component
  field: string
  stored: unknown
  props: Record<string, unknown>
  opener: string
  open: (opener: HTMLElement) => void
  sheet: string
}

const sheetCases: SheetCase[] = [
  {
    name: 'CwaUiSelect',
    component: Select,
    field: 'uiComponent',
    stored: 'wide',
    props: { options: [{ label: 'Wide', value: 'wide' }, { label: 'Split image', value: 'split' }] },
    opener: '[data-testid="select-trigger"]',
    open: opener => opener.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })),
    sheet: '[data-testid="select-sheet"]',
  },
  { ...cases[0]!, open: opener => opener.click(), sheet: '[data-testid="multi-sheet"]' },
  { ...cases[1]!, open: opener => opener.click(), sheet: '[data-testid="search-sheet"]' },
]

describe.each(sheetCases)('$name presence with its phone sheet open (#461)', (item) => {
  beforeEach(() => {
    onPhone()
    store.entry = reactive({ data: { '@id': '/component/1', [item.field]: item.stored }, apiState: {} })
    view.focus.mockClear()
    view.blur.mockClear()
    view.peers = []
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test('moving into the sheet it opened and closing it again never reports leaving the field; a pointerdown elsewhere afterwards does', async () => {
    const wrapper = mountCase(item as unknown as MenuCase)
    const opener = wrapper.get<HTMLElement>(item.opener)
    await opener.trigger('focusin')
    item.open(opener.element)
    await flushPromises()
    const sheet = document.querySelector<HTMLElement>(item.sheet)!
    const inside = sheet.querySelector<HTMLElement>('[role="option"]')!
    expect(wrapper.element.contains(sheet)).toBe(false)

    opener.element.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: inside }))
    inside.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    inside.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    await flushPromises()
    expect(view.focus).toHaveBeenCalled()
    expect(view.blur).not.toHaveBeenCalled()

    sheet.querySelector<HTMLElement>('[data-testid$="-sheet-close"]')!.click()
    await flushPromises()
    expect(wrapper.element.contains(document.activeElement)).toBe(true)
    expect(view.blur).not.toHaveBeenCalled()

    ;(document.activeElement as HTMLElement | null)?.blur()
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    await flushPromises()
    expect(view.blur).toHaveBeenCalledTimes(1)
  })
})

describe('a kit field bound to a resource model (#476 review 3)', () => {
  beforeEach(() => {
    store.entry = reactive({ data: { '@id': '/component/1', 'title': 'Summer' }, apiState: {} })
    view.focus.mockClear()
    view.blur.mockClear()
  })

  test('reports leaving when it becomes disabled while focused', async () => {
    const disabled = ref(false)
    const Host = defineComponent({
      setup() {
        const model = useCwaResourceModel(ref('/component/1'), 'title', { debounceTime: 0 })
        return () => h(Input, { label: 'Title', model, disabled: disabled.value })
      },
    })
    const wrapper = mount(Host, { attachTo: document.body })
    const input = wrapper.get('input')
    ;(input.element as HTMLInputElement).focus()
    await flushPromises()
    expect(view.focus).toHaveBeenCalledOnce()
    expect(view.blur).not.toHaveBeenCalled()

    disabled.value = true
    await flushPromises()

    expect(view.blur).toHaveBeenCalledOnce()
  })
})
