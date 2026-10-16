// @vitest-environment happy-dom
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import Group from './Group.vue'

const resource = ref<any>()
const resourceStack = ref([{ iri: '/_/component_groups/g1' }])
const initAddResource = vi.fn()

vi.mock('#cwa/composables/cwa-resource-manager-tab', () => ({
  useCwaResourceManagerTab: () => ({
    iri: ref('/_/component_groups/g1'),
    resource,
    $cwa: {
      resourcesManager: { initAddResource },
      admin: { resourceStackManager: { resourceStack } },
    },
    exposeMeta: { disabled: ref(false) },
  }),
}))

const CwaUiFormButton = {
  name: 'CwaUiFormButton',
  props: { disabled: { type: Boolean, default: false } },
  emits: ['click'],
  template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
}

function mountGroup(data: Record<string, any>) {
  resource.value = { data: { '@id': '/_/component_groups/g1', ...data } }
  return mount(Group, { global: { stubs: { CwaUiFormButton } } })
}

describe('Group tab (#398)', () => {
  beforeEach(() => {
    initAddResource.mockClear()
  })

  test('adds to the start and end of a group with room', async () => {
    const wrapper = mountGroup({ maxComponents: 2, componentPositions: ['/p1'] })
    const buttons = wrapper.findAllComponents(CwaUiFormButton)

    expect(buttons.map(button => button.props('disabled'))).toEqual([false, false])
    await buttons[0]!.trigger('click')
    await buttons[1]!.trigger('click')
    expect(initAddResource.mock.calls.map(call => call.slice(0, 2))).toEqual([
      ['/_/component_groups/g1', false],
      ['/_/component_groups/g1', true],
    ])
  })

  test.each([
    [1, 'This group holds at most 1 component'],
    [2, 'This group holds at most 2 components'],
  ])('disables adding to a full group of %s, saying why on hover', (max, reason) => {
    const wrapper = mountGroup({ maxComponents: max, componentPositions: Array.from({ length: max }, (_, i) => `/p${i}`) })

    expect(wrapper.findAllComponents(CwaUiFormButton).map(button => button.props('disabled'))).toEqual([true, true])
    expect(wrapper.find('[data-testid="group-full"]').attributes('title')).toBe(reason)
    expect(wrapper.find('[data-testid="group-over-limit"]').exists()).toBe(false)
  })

  test('does not add to a full group when clicked anyway', async () => {
    const wrapper = mountGroup({ maxComponents: 1, componentPositions: ['/p1'] })

    await wrapper.findAllComponents(CwaUiFormButton)[1]!.vm.$emit('click')

    expect(initAddResource).not.toHaveBeenCalled()
  })

  test('warns in the same row about a group over its limit, removing nothing', () => {
    const wrapper = mountGroup({ maxComponents: 1, componentPositions: ['/p1', '/p2', '/p3'] })

    const warning = wrapper.find('[data-testid="group-over-limit"]')
    expect(warning.text()).toBe('Holds 3 of 1. Remove components to add more.')
    expect(wrapper.findAllComponents(CwaUiFormButton).map(button => button.props('disabled'))).toEqual([true, true])
  })

  test('a group with no limit is never full', () => {
    const wrapper = mountGroup({ componentPositions: ['/p1', '/p2'] })

    expect(wrapper.findAllComponents(CwaUiFormButton).map(button => button.props('disabled'))).toEqual([false, false])
    expect(wrapper.find('[data-testid="group-full"]').attributes('title')).toBeUndefined()
  })
})
