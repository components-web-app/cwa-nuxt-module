// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createConfirmDialog } from 'vuejs-confirm-dialog'
import UnrenderedComponentGroupsModal from './UnrenderedComponentGroupsModal.vue'
import * as cwaComposable from '#cwa/composables/cwa'
import { mergeComponentGroup } from '#cwa/admin/unrendered-component-groups'
import type { RenderedComponentGroup, UnrenderedComponentGroup } from '#cwa/admin/unrendered-component-groups'

vi.mock('#cwa/templates/components/core/ConfirmDialog.vue', () => ({ default: {} }))
vi.mock('vuejs-confirm-dialog', () => ({
  createConfirmDialog: vi.fn(),
}))
vi.mock('#cwa/admin/unrendered-component-groups', () => ({
  mergeComponentGroup: vi.fn(),
}))

const deleteResource = vi.fn()
const $cwa = { resourcesManager: { deleteResource } }

const groups: UnrenderedComponentGroup[] = [
  {
    iri: '/_/component_groups/top',
    reference: 'top',
    fromLayout: false,
    positions: [
      { iri: '/_/component_positions/a', component: '/component/html/1', componentType: 'HtmlContent' },
      { iri: '/_/component_positions/dyn', pageDataProperty: 'heroImage' },
    ],
  },
  {
    iri: '/_/component_groups/footer',
    reference: 'footer',
    fromLayout: true,
    positions: [],
  },
]

const targets: RenderedComponentGroup[] = [
  { iri: '/_/component_groups/hero', reference: 'hero' },
  { iri: '/_/component_groups/top', reference: 'top' },
]

function confirmWith(isCanceled: boolean) {
  const reveal = vi.fn().mockResolvedValue({ isCanceled })
  vi.mocked(createConfirmDialog).mockReturnValue({ reveal } as any)
  return reveal
}

function mountModal() {
  return mount(UnrenderedComponentGroupsModal, {
    props: { groups, targets },
    global: {
      stubs: {
        CwaUiFormSelect: {
          name: 'CwaUiFormSelect',
          props: ['options', 'modelValue'],
          emits: ['update:modelValue'],
          template: '<div class="select-stub" />',
        },
        CwaUiFormButton: {
          name: 'CwaUiFormButton',
          props: ['color', 'disabled'],
          template: '<button type="button" :disabled="disabled" @click="$emit(\'click\', $event)"><slot /></button>',
        },
        CwaUiIconXMarkIcon: { template: '<svg />' },
      },
    },
  })
}

function section(wrapper: ReturnType<typeof mountModal>, index: number) {
  return wrapper.findAll('[data-testid="unrendered-group"]')[index]!
}

function button(wrapper: ReturnType<typeof mountModal>, index: number, label: string) {
  return section(wrapper, index).findAll('button').find(b => b.text() === label)!
}

async function chooseTarget(wrapper: ReturnType<typeof mountModal>, index: number, iri: string) {
  section(wrapper, index).findComponent({ name: 'CwaUiFormSelect' }).vm.$emit('update:modelValue', iri)
  await wrapper.vm.$nextTick()
}

describe('UnrenderedComponentGroupsModal', () => {
  beforeEach(() => {
    // @ts-expect-error partial Cwa
    vi.spyOn(cwaComposable, 'useCwa').mockImplementation(() => $cwa)
  })

  afterEach(() => {
    vi.mocked(createConfirmDialog).mockReset()
    vi.mocked(mergeComponentGroup).mockReset()
    deleteResource.mockReset()
    vi.restoreAllMocks()
  })

  test('lists each group with its components, and notes only the layout group as possibly shown elsewhere', () => {
    const wrapper = mountModal()
    expect(section(wrapper, 0).text()).toContain('top')
    expect(section(wrapper, 0).text()).toContain('HtmlContent')
    expect(section(wrapper, 0).text()).toContain('/component/html/1')
    expect(section(wrapper, 0).text()).toContain('heroImage')
    expect(section(wrapper, 0).find('[data-testid="unrendered-group-layout-note"]').exists()).toBe(false)
    expect(section(wrapper, 1).find('[data-testid="unrendered-group-layout-note"]').text()).toContain('may be shown on other pages')
  })

  test('offers only rendered groups as merge targets, never the group itself', () => {
    const wrapper = mountModal()
    const options = section(wrapper, 0).findComponent({ name: 'CwaUiFormSelect' }).props('options')
    expect(options).toEqual([{ label: 'hero', value: '/_/component_groups/hero' }])
  })

  test('cannot merge before a target is chosen, or an empty group at all', async () => {
    const wrapper = mountModal()
    expect(button(wrapper, 0, 'Merge').attributes('disabled')).toBeDefined()
    await chooseTarget(wrapper, 0, '/_/component_groups/hero')
    expect(button(wrapper, 0, 'Merge').attributes('disabled')).toBeUndefined()
    await chooseTarget(wrapper, 1, '/_/component_groups/hero')
    expect(button(wrapper, 1, 'Merge').attributes('disabled')).toBeDefined()
  })

  test('merging asks for confirmation first, and cancelling sends nothing', async () => {
    const reveal = confirmWith(true)
    const wrapper = mountModal()
    await chooseTarget(wrapper, 0, '/_/component_groups/hero')
    await button(wrapper, 0, 'Merge').trigger('click')
    await flushPromises()
    expect(reveal).toHaveBeenCalledTimes(1)
    expect(mergeComponentGroup).not.toHaveBeenCalled()
  })

  test('a confirmed merge moves the group into the chosen target', async () => {
    confirmWith(false)
    vi.mocked(mergeComponentGroup).mockResolvedValue({ failed: [], sourceDeleted: true })
    const wrapper = mountModal()
    await chooseTarget(wrapper, 0, '/_/component_groups/hero')
    await button(wrapper, 0, 'Merge').trigger('click')
    await flushPromises()
    expect(mergeComponentGroup).toHaveBeenCalledWith($cwa, '/_/component_groups/top', '/_/component_groups/hero')
    expect(section(wrapper, 0).find('[data-testid="unrendered-group-outcome"]').exists()).toBe(false)
  })

  test('reports the positions that could not be moved and that the group was kept', async () => {
    confirmWith(false)
    vi.mocked(mergeComponentGroup).mockResolvedValue({ failed: ['/_/component_positions/a'], sourceDeleted: false })
    const wrapper = mountModal()
    await chooseTarget(wrapper, 0, '/_/component_groups/hero')
    await button(wrapper, 0, 'Merge').trigger('click')
    await flushPromises()
    const outcome = section(wrapper, 0).find('[data-testid="unrendered-group-outcome"]')
    expect(outcome.text()).toContain('kept')
    expect(outcome.text()).toContain('/_/component_positions/a')
  })

  test('reports when everything moved but the empty group could not be deleted', async () => {
    confirmWith(false)
    vi.mocked(mergeComponentGroup).mockResolvedValue({ failed: [], sourceDeleted: false })
    const wrapper = mountModal()
    await chooseTarget(wrapper, 0, '/_/component_groups/hero')
    await button(wrapper, 0, 'Merge').trigger('click')
    await flushPromises()
    expect(section(wrapper, 0).find('[data-testid="unrendered-group-outcome"]').text()).toContain('could not be deleted')
  })

  test('delete goes through the resource manager\'s own confirmation', async () => {
    const wrapper = mountModal()
    await button(wrapper, 1, 'Delete').trigger('click')
    await flushPromises()
    expect(deleteResource).toHaveBeenCalledTimes(1)
    expect(deleteResource.mock.calls[0]).toEqual([{ endpoint: '/_/component_groups/footer' }])
    expect(createConfirmDialog).not.toHaveBeenCalled()
  })

  test('the close button emits close', async () => {
    const wrapper = mountModal()
    await wrapper.find('[data-testid="unrendered-groups-close"]').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })
})
