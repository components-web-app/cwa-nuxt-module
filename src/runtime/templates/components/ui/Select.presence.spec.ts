// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { computed, defineComponent, h, reactive, ref } from 'vue'
import { axe } from '../../../../../test/utils/axe'
import Select from './Select.vue'
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

const options = [{ label: 'Split image', value: 'CwaComponentSplit' }, { label: 'Wide', value: 'wide' }]

function mountSelect() {
  const Host = defineComponent({
    setup() {
      const model = useCwaResourceModel<string>(ref('/component/1'), 'uiComponent', { debounceTime: 0 })
      return () => h(Select, { label: 'UI', options, model })
    },
  })
  return mount(Host, { attachTo: document.body })
}

async function open(wrapper: ReturnType<typeof mountSelect>) {
  await wrapper.get('[data-testid="select-trigger"]').trigger('keydown', { key: 'Enter' })
  await flushPromises()
  return document.querySelector<HTMLElement>('[data-testid="select-menu"]')!
}

describe('CwaUiSelect presence (#460)', () => {
  beforeEach(() => {
    store.entry = reactive({ data: { '@id': '/component/1', 'uiComponent': 'CwaComponentSplit' }, apiState: {} })
    view.focus.mockClear()
    view.blur.mockClear()
    view.peers = []
  })

  test('shows a peer editing the field', async () => {
    view.peers = [{ user: { id: '/_/users/mia' }, name: 'Mia', colour: '#d946ef' }]
    const wrapper = mountSelect()
    await flushPromises()

    expect(wrapper.get('[data-testid="field-presence-flag"]').text()).toBe('Mia')
    expect(await axe(wrapper.element as HTMLElement)).toHaveNoViolations()
  })

  test('opening the menu and choosing from it never reports leaving the field; a pointerdown elsewhere does', async () => {
    const wrapper = mountSelect()
    const trigger = wrapper.get('[data-testid="select-trigger"]')
    trigger.element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    await trigger.trigger('focusin')
    const menu = await open(wrapper)
    const item = menu.querySelector<HTMLElement>('[role="option"]')!
    expect(trigger.attributes('aria-controls')).toBe(menu.id)

    trigger.element.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: item }))
    item.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    await flushPromises()
    item.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'mouse' }))
    await flushPromises()
    expect(document.querySelector('[data-testid="select-menu"]')).toBeNull()
    expect(view.focus).toHaveBeenCalled()
    expect(view.blur).not.toHaveBeenCalled()

    const focused = document.activeElement as HTMLElement | null
    focused?.blur()
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    await flushPromises()
    expect(view.blur).toHaveBeenCalledTimes(1)
  })
})
