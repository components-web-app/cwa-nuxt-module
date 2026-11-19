// @vitest-environment happy-dom
import { afterEach, describe, test, expect, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { computed, nextTick, ref } from 'vue'
import { axe } from '../../../../../../../../../test/utils/axe'
import Order from './Order.vue'
import CwaUiNumber from '#cwa/templates/components/ui/Number.vue'

const requestCount = ref(0)
const displayNumber = ref(2)
const syncingNumber = ref<number | undefined>()
const emit = vi.fn()
const reorderFailed = ref(false)
const retry = vi.fn()
const dismiss = vi.fn()

vi.mock('#cwa/composables/cwa-resource-manager-tab', () => ({
  useCwaResourceManagerTab: () => ({
    $cwa: {
      admin: {
        resourceStackManager: {
          getClosestStackItemByType: (type: string) => type === 'COMPONENT_POSITION' ? '/_/component_positions/p1' : '/_/component_groups/g1',
          currentIri: ref('/component/c1'),
        },
        eventBus: { emit },
      },
      resources: {
        getPositionSortDisplayNumber: () => displayNumber.value,
        getOrderedPositionsForGroup: () => ['/_/component_positions/p0', '/_/component_positions/p1', '/_/component_positions/p2'],
        getResource: () => computed(() => ({ data: { _metadata: { sortDisplayNumber: syncingNumber.value } } })),
      },
      resourcesManager: { requestCount },
      componentGroupReorders: { failed: (iri: string) => iri === '/_/component_groups/g1' && reorderFailed.value, retry, dismiss },
    },
    exposeMeta: { disabled: ref(false), fields: [] },
  }),
}))

vi.mock('#cwa/composables/cwa', () => ({ useCwa: () => ({ admin: { resourceStackManager: { currentIri: ref('/component/c1') } } }) }))

enableAutoUnmount(afterEach)

function step(wrapper: ReturnType<typeof mount>, name: string) {
  return wrapper.get(`button[aria-label="${name}"]`)
}

function positionLine(wrapper: ReturnType<typeof mount>) {
  return wrapper.findAll('[data-testid="field-status-line"]').at(-1)!.attributes('data-line')
}

describe('Order tab on the kit (#400, #459)', () => {
  afterEach(() => {
    emit.mockReset()
    requestCount.value = 0
    displayNumber.value = 2
    syncingNumber.value = undefined
    reorderFailed.value = false
    retry.mockReset()
    dismiss.mockReset()
  })

  test('Move up and Move down move the position by one while requests are in flight, so moves are never held back', async () => {
    requestCount.value = 3
    const wrapper = mount(Order)

    await step(wrapper, 'Move up').trigger('click')
    expect(emit).toHaveBeenCalledWith('reorder', { positionIri: '/_/component_positions/p1', location: 1 })
    displayNumber.value = 1
    await nextTick()
    await step(wrapper, 'Move down').trigger('click')
    expect(emit).toHaveBeenLastCalledWith('reorder', { positionIri: '/_/component_positions/p1', location: 2 })
  })

  test('the position is bounded by the group: the first cannot move up and says why, and an out-of-range number snaps to the last', async () => {
    displayNumber.value = 1
    const wrapper = mount(Order)

    expect(step(wrapper, 'Move up').attributes('aria-disabled')).toBe('true')
    expect(step(wrapper, 'Move up').attributes('title')).toBe('Already first in this group')
    await step(wrapper, 'Move up').trigger('click')
    expect(emit).not.toHaveBeenCalled()

    const input = wrapper.get('input[role="spinbutton"]')
    expect(input.attributes('aria-valuemax')).toBe('3')
    await input.setValue('9')
    await input.trigger('blur')
    expect(emit).toHaveBeenCalledWith('reorder', { positionIri: '/_/component_positions/p1', location: 3 })
  })

  test('the position shows saving on its edge line while the new order syncs, then saved', async () => {
    syncingNumber.value = 1
    const wrapper = mount(Order)

    expect(positionLine(wrapper)).toBe('saving')
    syncingNumber.value = undefined
    await nextTick()
    await nextTick()
    expect(positionLine(wrapper)).toBe('saved')
  })

  test('a reorder the API refused shows not saved on the position, never saved, and Retry sends the group\'s order again', async () => {
    syncingNumber.value = 1
    const wrapper = mount(Order, { attachTo: document.body })
    reorderFailed.value = true
    syncingNumber.value = undefined
    await nextTick()
    await nextTick()

    expect(positionLine(wrapper)).toBe('error')
    const input = wrapper.get<HTMLInputElement>('input[role="spinbutton"]')
    expect(input.attributes('aria-invalid')).toBe('true')
    input.element.focus()
    await flushPromises()
    document.querySelector<HTMLElement>('[data-testid="field-status-retry"]')!.click()
    expect(retry).toHaveBeenCalledWith('/_/component_groups/g1')
  })

  test('Reset on a refused reorder dismisses it, as the group already shows the saved order', async () => {
    reorderFailed.value = true
    const wrapper = mount(Order, { attachTo: document.body })
    await nextTick()

    wrapper.get<HTMLInputElement>('input[role="spinbutton"]').element.focus()
    await flushPromises()
    document.querySelector<HTMLElement>('[data-testid="field-status-reset"]')!.click()
    expect(dismiss).toHaveBeenCalledWith('/_/component_groups/g1')
  })

  test('has no Enable reordering toggle, which belongs to the selected group, and the position says so', () => {
    const wrapper = mount(Order, { attachTo: document.body })

    expect(document.querySelector('[role="switch"]')).toBeNull()
    expect(wrapper.findComponent(CwaUiNumber).props('info')).toBe('Its place in this group, from the top. Select the group and turn on Enable reordering to drag its components.')
  })

  test('has no axe violations', async () => {
    const wrapper = mount(Order, { attachTo: document.body })

    expect(await axe(wrapper.element as HTMLElement)).toHaveNoViolations()
  })
})
