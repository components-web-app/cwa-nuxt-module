// @vitest-environment happy-dom
import { afterEach, describe, test, expect, vi, beforeEach } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { ref } from 'vue'
import { axe } from '../../../../../../../../../test/utils/axe'
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
vi.mock('#cwa/composables/cwa', () => ({ useCwa: () => ({ admin: { resourceStackManager: { currentIri: ref('/_/component_groups/g1') } } }) }))

enableAutoUnmount(afterEach)

function mountGroup(data: Record<string, any>) {
  resource.value = { data: { '@id': '/_/component_groups/g1', ...data } }
  return mount(Group, { attachTo: document.body })
}

function buttons(wrapper: ReturnType<typeof mountGroup>) {
  return [wrapper.get('[data-testid="group-add-start"]'), wrapper.get('[data-testid="group-add-end"]')]
}

describe('Group tab (#398)', () => {
  beforeEach(() => {
    initAddResource.mockClear()
  })

  test('is one manager bar row (#461)', async () => {
    const wrapper = mountGroup({ maxComponents: 1, componentPositions: ['/p1', '/p2'] })

    const row = wrapper.get('[data-testid="manager-tab"]')
    expect(row.element).toBe(wrapper.element)
    expect(buttons(wrapper).every(button => row.element.contains(button.element))).toBe(true)
    expect(row.element.contains(wrapper.get('[data-testid="group-over-limit"]').element)).toBe(true)
    expect(await axe(wrapper.element as HTMLElement)).toHaveNoViolations()
  })

  test('adds to the start and end of a group with room', async () => {
    const wrapper = mountGroup({ maxComponents: 2, componentPositions: ['/p1'] })
    const [start, end] = buttons(wrapper)

    expect([start!.attributes('aria-disabled'), end!.attributes('aria-disabled')]).toEqual([undefined, undefined])
    await start!.trigger('click')
    await end!.trigger('click')
    expect(initAddResource.mock.calls.map(call => call.slice(0, 2))).toEqual([
      ['/_/component_groups/g1', false],
      ['/_/component_groups/g1', true],
    ])
    expect(await axe(wrapper.element as HTMLElement)).toHaveNoViolations()
  })

  test.each([
    [1, 'This group holds at most 1 component'],
    [2, 'This group holds at most 2 components'],
  ])('disables adding to a full group of %s, saying why on hover', async (max, reason) => {
    const wrapper = mountGroup({ maxComponents: max, componentPositions: Array.from({ length: max }, (_, i) => `/p${i}`) })

    for (const button of buttons(wrapper)) {
      expect(button.attributes('aria-disabled')).toBe('true')
      expect(button.attributes('title')).toBe(reason)
      expect(document.getElementById(button.attributes('aria-describedby')!)?.textContent).toBe(reason)
    }
    expect(wrapper.find('[data-testid="group-over-limit"]').exists()).toBe(false)
    expect(await axe(wrapper.element as HTMLElement)).toHaveNoViolations()
  })

  test('does not add to a full group when pressed anyway, and shows why instead, which a touch screen cannot hover for (#476 review 6)', async () => {
    const wrapper = mountGroup({ maxComponents: 1, componentPositions: ['/p1'] })

    await buttons(wrapper)[1]!.trigger('click')

    expect(initAddResource).not.toHaveBeenCalled()
    await vi.waitFor(() => expect(document.querySelector('[data-testid="button-reason"]')?.textContent?.trim()).toBe('This group holds at most 1 component'))
    expect(await axe(document.body)).toHaveNoViolations()
  })

  test('warns in the same row about a group over its limit, removing nothing', () => {
    const wrapper = mountGroup({ maxComponents: 1, componentPositions: ['/p1', '/p2', '/p3'] })

    const warning = wrapper.find('[data-testid="group-over-limit"]')
    expect(warning.text()).toBe('Holds 3 of 1. Remove components to add more.')
    expect(buttons(wrapper).map(button => button.attributes('aria-disabled'))).toEqual(['true', 'true'])
  })

  test('a group with no limit is never full', () => {
    const wrapper = mountGroup({ componentPositions: ['/p1', '/p2'] })

    expect(buttons(wrapper).map(button => button.attributes('aria-disabled'))).toEqual([undefined, undefined])
    expect(buttons(wrapper).map(button => button.attributes('title'))).toEqual([undefined, undefined])
  })
})
