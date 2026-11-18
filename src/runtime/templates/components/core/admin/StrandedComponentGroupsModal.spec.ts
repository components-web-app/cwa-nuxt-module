// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createConfirmDialog } from 'vuejs-confirm-dialog'
import StrandedComponentGroupsModal from './StrandedComponentGroupsModal.vue'
import * as cwaComposable from '#cwa/composables/cwa'
import { mergeComponentGroup } from '#cwa/admin/stranded-component-groups'
import type { ShownComponentGroup, StrandedComponentGroup } from '#cwa/admin/stranded-component-groups'

vi.mock('#app/nuxt', async importOriginal => ({
  ...await importOriginal<typeof import('#app/nuxt')>(),
  useNuxtApp: () => ({ vueApp: {} }),
}))
vi.mock('#cwa/templates/components/core/ui/Confirm.vue', () => ({ default: {} }))
vi.mock('vuejs-confirm-dialog', () => ({
  install: vi.fn(),
  createConfirmDialog: vi.fn(),
}))
vi.mock('#cwa/admin/stranded-component-groups', () => ({
  mergeComponentGroup: vi.fn(),
}))

const deleteResource = vi.fn()
const groupData: Record<string, any> = {}
const $cwa = {
  resourcesManager: { deleteResource },
  resources: { getResource: vi.fn((iri: string) => ({ value: groupData[iri] ? { data: groupData[iri] } : undefined })) },
}

const groups: StrandedComponentGroup[] = [
  {
    iri: '/_/component_groups/top',
    reference: 'top',
    positions: [
      { iri: '/_/component_positions/a', component: '/component/html/1', componentType: 'HtmlContent' },
      { iri: '/_/component_positions/dyn', pageDataProperty: 'heroImage' },
    ],
  },
  {
    iri: '/_/component_groups/footer',
    reference: 'footer',
    positions: [],
  },
]

const targets: ShownComponentGroup[] = [
  { iri: '/_/component_groups/hero', reference: 'hero' },
  { iri: '/_/component_groups/top', reference: 'top' },
]

function confirmWith(isCanceled: boolean) {
  const reveal = vi.fn().mockResolvedValue({ isCanceled })
  vi.mocked(createConfirmDialog).mockReturnValue({ reveal } as any)
  return reveal
}

function mountModal(options: { realDialog?: boolean, attachTo?: HTMLElement } = {}) {
  return mount(StrandedComponentGroupsModal, {
    props: { groups, targets },
    attachTo: options.attachTo,
    global: {
      stubs: {
        CwaUiDialog: options.realDialog
          ? false
          : {
              name: 'CwaUiDialog',
              props: ['title', 'size'],
              emits: ['close'],
              template: '<div class="dialog-stub"><button type="button" data-testid="dialog-close" @click="$emit(\'close\')">Close</button><slot /><slot name="footer" /></div>',
            },
        CwaUiSelect: {
          name: 'CwaUiSelect',
          props: ['options', 'modelValue', 'label', 'placeholder', 'disabled', 'disabledReason'],
          emits: ['update:modelValue'],
          template: '<div class="select-stub" />',
        },
        CwaUiButton: {
          name: 'CwaUiButton',
          props: ['label', 'variant', 'tone', 'disabled', 'disabledReason', 'loading'],
          emits: ['click'],
          template: '<button type="button" :aria-disabled="disabled ? \'true\' : undefined" @click="disabled || $emit(\'click\', $event)">{{ label }}</button>',
        },
        CwaUiAlert: {
          name: 'CwaUiAlert',
          props: ['tone', 'title'],
          template: '<div class="alert-stub">{{ title }}<slot /></div>',
        },
      },
    },
  })
}

function section(wrapper: ReturnType<typeof mountModal>, index: number) {
  return wrapper.findAll('[data-testid="stranded-group"]')[index]!
}

function button(wrapper: ReturnType<typeof mountModal>, index: number, label: string) {
  return section(wrapper, index).findAll('button').find(b => b.text() === label)!
}

async function chooseTarget(wrapper: ReturnType<typeof mountModal>, index: number, iri: string) {
  section(wrapper, index).findComponent({ name: 'CwaUiSelect' }).vm.$emit('update:modelValue', iri)
  await wrapper.vm.$nextTick()
}

describe('StrandedComponentGroupsModal', () => {
  beforeEach(() => {
    // @ts-expect-error partial Cwa
    vi.spyOn(cwaComposable, 'useCwa').mockImplementation(() => $cwa)
  })

  afterEach(() => {
    vi.mocked(createConfirmDialog).mockReset()
    vi.mocked(mergeComponentGroup).mockReset()
    deleteResource.mockReset()
    for (const iri of Object.keys(groupData)) {
      delete groupData[iri]
    }
    vi.restoreAllMocks()
  })

  test('lists each group with its components', () => {
    const wrapper = mountModal()
    expect(section(wrapper, 0).text()).toContain('top')
    expect(section(wrapper, 0).text()).toContain('HtmlContent')
    expect(section(wrapper, 0).text()).toContain('/component/html/1')
    expect(section(wrapper, 0).text()).toContain('heroImage')
    expect(section(wrapper, 1).text()).toContain('footer')
    expect(section(wrapper, 1).text()).toContain('This group is empty.')
  })

  test('offers only shown groups as merge targets, never the group itself', () => {
    const wrapper = mountModal()
    const options = section(wrapper, 0).findComponent({ name: 'CwaUiSelect' }).props('options')
    expect(options).toEqual([{ label: 'hero', value: '/_/component_groups/hero' }])
  })

  test.each([
    ['room for every component', { maxComponents: 3, componentPositions: ['/_/component_positions/h1'] }, true],
    ['no limit', { componentPositions: ['/_/component_positions/h1'] }, true],
    ['too little room for every component', { maxComponents: 2, componentPositions: ['/_/component_positions/h1'] }, false],
    ['a full group', { maxComponents: 1, componentPositions: ['/_/component_positions/h1'] }, false],
  ])('offers a target with %s only when it can take them all (#398)', (_label, data, offered) => {
    groupData['/_/component_groups/hero'] = data
    const wrapper = mountModal()
    const options = section(wrapper, 0).findComponent({ name: 'CwaUiSelect' }).props('options')
    expect(options).toEqual(offered ? [{ label: 'hero', value: '/_/component_groups/hero' }] : [])
  })

  test('cannot merge before a target is chosen, or an empty group at all', async () => {
    const wrapper = mountModal()
    expect(button(wrapper, 0, 'Merge').attributes('aria-disabled')).toBe('true')
    expect(section(wrapper, 0).findAllComponents({ name: 'CwaUiButton' })[0]!.props('disabledReason')).toBe('Choose a group to merge into first.')
    await chooseTarget(wrapper, 0, '/_/component_groups/hero')
    expect(button(wrapper, 0, 'Merge').attributes('aria-disabled')).toBeUndefined()
    await chooseTarget(wrapper, 1, '/_/component_groups/hero')
    expect(button(wrapper, 1, 'Merge').attributes('aria-disabled')).toBe('true')
    expect(section(wrapper, 1).findAllComponents({ name: 'CwaUiButton' })[0]!.props('disabledReason')).toBe('This group is empty.')
  })

  test('merging asks for confirmation first, and cancelling sends nothing', async () => {
    const reveal = confirmWith(true)
    const wrapper = mountModal()
    await chooseTarget(wrapper, 0, '/_/component_groups/hero')
    await button(wrapper, 0, 'Merge').trigger('click')
    await vi.waitFor(() => expect(createConfirmDialog).toHaveBeenCalled())
    await flushPromises()
    expect(reveal).toHaveBeenCalledWith({
      title: 'Merge component group?',
      description: 'Move the 2 components in “top” to the end of “hero”, then delete the empty “top” group?',
      keep: 'Cancel',
      go: 'Merge',
      tone: 'accent',
    })
    expect(mergeComponentGroup).not.toHaveBeenCalled()
  })

  test('a confirmed merge moves the group into the chosen target', async () => {
    confirmWith(false)
    vi.mocked(mergeComponentGroup).mockResolvedValue({ failed: [], sourceDeleted: true })
    const wrapper = mountModal()
    await chooseTarget(wrapper, 0, '/_/component_groups/hero')
    await button(wrapper, 0, 'Merge').trigger('click')
    await vi.waitFor(() => expect(createConfirmDialog).toHaveBeenCalled())
    await flushPromises()
    expect(mergeComponentGroup).toHaveBeenCalledWith($cwa, '/_/component_groups/top', '/_/component_groups/hero')
    expect(section(wrapper, 0).find('[data-testid="stranded-group-outcome"]').exists()).toBe(false)
  })

  test('reports the positions that could not be moved and that the group was kept', async () => {
    confirmWith(false)
    vi.mocked(mergeComponentGroup).mockResolvedValue({ failed: ['/_/component_positions/a'], sourceDeleted: false })
    const wrapper = mountModal()
    await chooseTarget(wrapper, 0, '/_/component_groups/hero')
    await button(wrapper, 0, 'Merge').trigger('click')
    await vi.waitFor(() => expect(createConfirmDialog).toHaveBeenCalled())
    await flushPromises()
    const outcome = section(wrapper, 0).find('[data-testid="stranded-group-outcome"]')
    expect(outcome.findComponent({ name: 'CwaUiAlert' }).props('tone')).toBe('danger')
    expect(outcome.text()).toContain('kept')
    expect(outcome.text()).toContain('/_/component_positions/a')
  })

  test('reports when everything moved but the empty group could not be deleted', async () => {
    confirmWith(false)
    vi.mocked(mergeComponentGroup).mockResolvedValue({ failed: [], sourceDeleted: false })
    const wrapper = mountModal()
    await chooseTarget(wrapper, 0, '/_/component_groups/hero')
    await button(wrapper, 0, 'Merge').trigger('click')
    await vi.waitFor(() => expect(createConfirmDialog).toHaveBeenCalled())
    await flushPromises()
    expect(section(wrapper, 0).find('[data-testid="stranded-group-outcome"]').text()).toContain('could not be deleted')
  })

  test('delete goes through the resource manager\'s own confirmation', async () => {
    const wrapper = mountModal()
    await button(wrapper, 1, 'Delete').trigger('click')
    await flushPromises()
    expect(deleteResource).toHaveBeenCalledTimes(1)
    expect(deleteResource.mock.calls[0]).toEqual([{ endpoint: '/_/component_groups/footer' }])
    expect(createConfirmDialog).not.toHaveBeenCalled()
  })

  test('is a kit dialog titled Stranded component groups, whose close emits close', async () => {
    const wrapper = mountModal()
    expect(wrapper.findComponent({ name: 'CwaUiDialog' }).props('title')).toBe('Stranded component groups')
    await wrapper.find('[data-testid="dialog-close"]').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  test('each merge target is chosen in a labelled kit select', () => {
    const wrapper = mountModal()
    expect(section(wrapper, 0).findComponent({ name: 'CwaUiSelect' }).props('label')).toBe('Merge into')
  })

  test('is portalled out of the page, so a click inside it does not reach the root layout (#380)', async () => {
    const root = document.createElement('div')
    const rootClick = vi.fn()
    root.addEventListener('click', rootClick)
    const mountPoint = document.createElement('div')
    root.appendChild(mountPoint)
    document.body.appendChild(root)
    const wrapper = mountModal({ realDialog: true, attachTo: mountPoint })
    await vi.waitFor(() => expect(document.querySelector('[data-testid="dialog"]')).not.toBeNull())
    const dialog = document.querySelector<HTMLElement>('[data-testid="dialog"]')!
    expect(root.contains(dialog)).toBe(false)
    dialog.click()
    expect(rootClick).not.toHaveBeenCalled()
    wrapper.unmount()
    root.remove()
  })
})
