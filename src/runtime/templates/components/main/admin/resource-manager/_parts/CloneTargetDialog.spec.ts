// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from 'vitest'
import { computed, ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { useCloneMode } from '#cwa/admin/clone-mode'
import type Cwa from '#cwa/cwa'

const state = vi.hoisted(() => ({ cwa: null as any, editingLayoutWhenCloned: undefined as boolean | undefined }))

vi.mock('#cwa/composables/cwa', () => ({
  useCwa: vi.fn(() => state.cwa),
}))

vi.mock('#cwa/admin/clone-component', () => ({
  cloneComponent: vi.fn(async () => {
    state.editingLayoutWhenCloned = state.cwa.admin.resourceStackManager.isEditingLayout.value
    return 'added'
  }),
}))

const SOURCE = '/component/html_contents/source'
const LAYOUT = '/_/layouts/layout'
const GROUP = '/_/component_groups/layout-group'
const POSITION = '/_/component_positions/p1'
const COMPONENT = '/component/html_contents/c1'

const byId: Record<string, Record<string, any>> = {
  [SOURCE]: { '@type': 'HtmlContent' },
  [LAYOUT]: { componentGroups: [GROUP] },
  [GROUP]: { componentPositions: [POSITION] },
  [POSITION]: { component: COMPONENT },
  [COMPONENT]: { '@type': 'HtmlContent' },
}

function makeCwa() {
  return {
    admin: {
      isEditing: true,
      setNavigationGuardDisabled: vi.fn(),
      resourceStackManager: { isEditingLayout: ref(false) },
    },
    auth: { user: { '@id': '/_/users/admin' } },
    getComponentMetadata: vi.fn(async () => ({
      HtmlContent: { resourceName: 'HtmlContent', endpoint: '/component/html_contents', isPublishable: true, explicitAllowOnly: false },
    })),
    resources: {
      isDataPage: computed(() => false),
      getResource: (iri: string) => computed(() => byId[iri] ? { data: byId[iri] } : undefined),
      getChildIris: () => [],
      findAllPublishableIris: (iri: string) => [iri],
      pageDataIriOf: () => computed(() => undefined),
      getOrderedPositionsForGroup: (iri: string) => byId[iri]?.componentPositions,
    },
  }
}

async function mountDialog() {
  const { default: CloneTargetDialog } = await import('./CloneTargetDialog.vue')
  const wrapper = mount(CloneTargetDialog, {
    props: {
      stack: [{ iri: COMPONENT }, { iri: POSITION }, { iri: GROUP }, { iri: LAYOUT }],
      type: 'layout',
    },
    global: {
      stubs: {
        DialogBox: {
          props: ['modelValue', 'buttons', 'title', 'isLoading'],
          emits: ['update:modelValue'],
          template: '<div v-if="modelValue" class="dialog-stub"><slot /><button v-for="b of buttons" :key="b.label" class="dialog-button" @click="b.callbackFn ? b.callbackFn() : $emit(\'update:modelValue\', false)">{{ b.label }}</button></div>',
        },
        Spinner: { template: '<div class="spinner-stub" />' },
        CwaUiAlertWarning: { template: '<div class="alert-stub"><slot /></div>' },
      },
    },
  })
  await flushPromises()
  return wrapper
}

function startCloning() {
  state.cwa = makeCwa()
  const cloneMode = useCloneMode(state.cwa as Cwa)
  cloneMode.start(SOURCE, 'Source')
  return cloneMode
}

describe('CloneTargetDialog', () => {
  afterEach(() => {
    state.cwa && useCloneMode(state.cwa as Cwa).end()
    state.editingLayoutWhenCloned = undefined
  })

  test('a layout target switches to layout editing before adding', async () => {
    startCloning()
    const { cloneComponent } = await import('#cwa/admin/clone-component')
    const wrapper = await mountDialog()

    expect(wrapper.find('[data-testid="clone-scope"]').text()).toBe('This is in the layout: it will appear on every page using it')
    const addAfter = wrapper.findAll('[data-testid="clone-option"]').find(button => button.text() === 'Add after')!
    await addAfter.trigger('click')
    await flushPromises()

    expect(cloneComponent).toHaveBeenCalledWith(state.cwa, {
      sourceIri: SOURCE,
      target: { kind: 'position', groupIri: GROUP, anchor: { after: POSITION } },
    })
    expect(state.editingLayoutWhenCloned).toBe(true)
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  test('Cancel closes the dialog and keeps clone mode on', async () => {
    const cloneMode = startCloning()
    const { cloneComponent } = await import('#cwa/admin/clone-component')
    const wrapper = await mountDialog()

    await wrapper.find('.dialog-button').trigger('click')

    expect(wrapper.emitted('close')).toHaveLength(1)
    expect(cloneComponent).not.toHaveBeenCalled()
    expect(cloneMode.source.value).toEqual({ iri: SOURCE, name: 'Source' })
    expect(state.cwa.admin.resourceStackManager.isEditingLayout.value).toBe(false)
  })

  test('a disabled option lists its reasons and sends nothing', async () => {
    startCloning()
    byId[GROUP]!.maxComponents = 1
    const { cloneComponent } = await import('#cwa/admin/clone-component')
    try {
      const wrapper = await mountDialog()
      const addBefore = wrapper.findAll('[data-testid="clone-option"]').find(button => button.text() === 'Add before')!

      expect(addBefore.attributes('disabled')).toBeDefined()
      expect(wrapper.text()).toContain('This group is full')
      await addBefore.trigger('click')
      expect(cloneComponent).not.toHaveBeenCalled()
    }
    finally {
      delete byId[GROUP]!.maxComponents
    }
  })

  test('closes when clone mode ends', async () => {
    const cloneMode = startCloning()
    const wrapper = await mountDialog()

    cloneMode.end()
    await flushPromises()

    expect(wrapper.emitted('close')).toHaveLength(1)
  })
})
