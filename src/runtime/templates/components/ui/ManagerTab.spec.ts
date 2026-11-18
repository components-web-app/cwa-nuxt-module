// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, provide, ref } from 'vue'
import { tabFieldsKey, tabMetaOnlyKey } from '../core/ui/field-keys'
import ManagerTab from './ManagerTab.vue'
import Input from './Input.vue'

const useCwaResourceModel = vi.fn((_iri: unknown, _field: string) => ({ model: ref('Hello'), remoteChange: ref(undefined) }))

vi.mock('#cwa/composables/cwa', () => ({ useCwa: () => ({ admin: { resourceStackManager: { currentIri: ref('/component/c1') } } }) }))
vi.mock('#cwa/composables/cwa-resource-model', () => ({ useCwaResourceModel: (iri: unknown, field: string) => useCwaResourceModel(iri, field) }))

enableAutoUnmount(afterEach)

function tabWith(metaOnly: boolean, fields: string[]) {
  return defineComponent({
    setup() {
      provide(tabFieldsKey, fields)
      metaOnly && provide(tabMetaOnlyKey, true)
      return () => h(ManagerTab, () => [h(Input, { label: 'Title', field: 'title' })])
    },
  })
}

describe('CwaUiManagerTab (#459)', () => {
  test('an editor\'s presence flag goes into the tab\'s own layer, outside the row that scrolls and clips, and the layer takes no clicks (#476 review 1)', async () => {
    const model = { model: ref('Kitchens'), remoteChange: ref(undefined), focusedBy: ref([{ user: { id: '/_/users/mia', name: 'Mia' }, name: 'Mia', colour: '#d946ef', isSelf: false, clientIds: ['tab-mia'] }]) }
    const wrapper = mount(defineComponent({ setup: () => () => h(ManagerTab, () => [h(Input, { label: 'Title', model })]) }))
    await nextTick()

    const layer = wrapper.get('[data-testid="manager-tab"] > [data-testid="presence-layer"]')
    expect(layer.classes()).toEqual(expect.arrayContaining(['cwa:absolute', 'cwa:inset-0', 'cwa:pointer-events-none']))
    expect(layer.get('[data-testid="field-presence-flag"]').text()).toBe('Mia')
    expect(wrapper.find('[role="region"], .cwa\\:overflow-x-auto').find('[data-testid="field-presence-flag"]').exists()).toBe(false)
  })

  afterEach(() => {
    useCwaResourceModel.mockClear()
  })

  test('a field="…" control in the tab binds to the selected resource\'s field and is listed in the tab\'s fields', () => {
    const fields: string[] = []
    const wrapper = mount(tabWith(false, fields))

    expect(useCwaResourceModel).toHaveBeenCalledTimes(1)
    expect((useCwaResourceModel.mock.calls[0]![0] as { value: string }).value).toBe('/component/c1')
    expect(useCwaResourceModel.mock.calls[0]![1]).toBe('title')
    expect(wrapper.get('input').element.value).toBe('Hello')
    expect(wrapper.get('[data-cwa-field="title"]').exists()).toBe(true)
    expect(fields).toEqual(['title'])
  })

  test('rendered only for its metadata, the tab lists its fields but creates no model and no row', () => {
    const fields: string[] = []
    const wrapper = mount(tabWith(true, fields))

    expect(useCwaResourceModel).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="manager-tab"]').exists()).toBe(false)
    expect(fields).toEqual(['title'])
  })

  test('a row that does not overflow is not a tab stop; one that does is a named, focusable region with fades', async () => {
    const wrapper = mount(ManagerTab, { slots: { default: () => h('span', 'x') } })
    const row = wrapper.get('[data-testid="manager-tab"] > div')
    expect(row.attributes('tabindex')).toBeUndefined()
    expect(row.attributes('role')).toBeUndefined()

    Object.defineProperty(row.element, 'scrollWidth', { value: 900 })
    Object.defineProperty(row.element, 'clientWidth', { value: 300 })
    await (wrapper.vm as unknown as { measure: () => void }).measure()
    await wrapper.vm.$nextTick()

    expect(row.attributes('tabindex')).toBe('0')
    expect(row.attributes('role')).toBe('region')
    expect(row.attributes('aria-label')).toBe('Fields')
    expect(wrapper.get('[data-testid="manager-tab"]').attributes('data-overflow-end')).toBe('true')
    expect(wrapper.get('[data-testid="manager-tab"]').attributes('data-overflow-start')).toBeUndefined()
  })
})
