// @vitest-environment happy-dom
import { describe, test, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import Order from './Order.vue'

const reordering = ref(true)
const requestCount = ref(0)
const emit = vi.fn()

vi.mock('#cwa/composables/cwa-resource-manager-tab', () => ({
  useCwaResourceManagerTab: () => ({
    $cwa: {
      admin: {
        resourceStackManager: { getClosestStackItemByType: () => '/_/component_positions/p1' },
        eventBus: { emit },
      },
      resources: { getPositionSortDisplayNumber: () => 2 },
      resourcesManager: { requestCount },
    },
    exposeMeta: { disabled: ref(false) },
    createComputedState: () => reordering,
  }),
}))

const stubs = {
  CwaUiFormToggle: { template: '<div />' },
  CwaUiFormInput: { template: '<input />' },
  CwaUiFormButton: { emits: ['click'], template: '<button @click="$emit(\'click\')"><slot /></button>' },
}

describe('Order tab (#400)', () => {
  test('the move controls stay usable while requests are in flight, so moves are never held back', async () => {
    requestCount.value = 3
    const wrapper = mount(Order, { global: { stubs } })
    const controls = wrapper.find('.cwa\\:flex.cwa\\:gap-x-4 > .cwa\\:flex.cwa\\:gap-x-4')

    expect(controls.classes()).not.toContain('cwa:pointer-events-none')
    await wrapper.findAll('button')[0]!.trigger('click')
    expect(emit).toHaveBeenCalledWith('reorder', { positionIri: '/_/component_positions/p1', location: 'previous' })
  })

  test('the move controls are disabled while reordering is off', () => {
    reordering.value = false
    requestCount.value = 0
    const wrapper = mount(Order, { global: { stubs } })
    expect(wrapper.find('.cwa\\:flex.cwa\\:gap-x-4 > .cwa\\:flex.cwa\\:gap-x-4').classes()).toContain('cwa:pointer-events-none')
    reordering.value = true
  })
})
