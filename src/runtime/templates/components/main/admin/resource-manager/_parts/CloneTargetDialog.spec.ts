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
  moveComponent: vi.fn(async () => {
    state.editingLayoutWhenCloned = state.cwa.admin.resourceStackManager.isEditingLayout.value
    return 'added'
  }),
}))

const SOURCE = '/component/html_contents/source'
const LAYOUT = '/_/layouts/layout'
const GROUP = '/_/component_groups/layout-group'
const POSITION = '/_/component_positions/p1'
const COMPONENT = '/component/html_contents/c1'
const PAGE = '/_/pages/page'
const DYNAMIC = '/_/component_positions/dynamic'
const PAGE_DATA = '/page_data/article'
const OCCUPANT = '/component/html_contents/occupant'

const byId: Record<string, Record<string, any>> = {
  [SOURCE]: { '@type': 'HtmlContent' },
  [LAYOUT]: { componentGroups: [GROUP] },
  [GROUP]: { componentPositions: [POSITION] },
  [POSITION]: { component: COMPONENT },
  [COMPONENT]: { '@type': 'HtmlContent' },
  [DYNAMIC]: { pageDataProperty: 'hero' },
  [PAGE_DATA]: { hero: OCCUPANT, _metadata: { pageDataMetadata: { properties: [{ property: 'hero', componentShortName: 'HtmlContent' }] } } },
  [OCCUPANT]: { '@type': 'HtmlContent' },
}

function textElement(text: string) {
  const element = document.createElement('div')
  element.textContent = text
  return element
}

function makeCwa() {
  return {
    admin: {
      isEditing: true,
      setNavigationGuardDisabled: vi.fn(),
      resourceStackManager: { isEditingLayout: ref(false) },
    },
    auth: { user: { '@id': '/_/users/admin' } },
    resourcesConfig: { HtmlContent: { name: 'Body Text' } },
    getComponentMetadata: vi.fn(async () => ({
      HtmlContent: { resourceName: 'HtmlContent', endpoint: '/component/html_contents', isPublishable: true, explicitAllowOnly: false },
    })),
    resources: {
      displayPageIri: computed(() => undefined),
      isDataPage: computed(() => false),
      getResource: (iri: string) => computed(() => byId[iri] ? { data: byId[iri] } : undefined),
      getChildIris: () => [],
      findAllPublishableIris: (iri: string) => [iri],
      pageDataIriOf: (iri: string) => computed(() => iri === DYNAMIC ? PAGE_DATA : undefined),
      getOrderedPositionsForGroup: (iri: string) => byId[iri]?.componentPositions,
    },
  }
}

async function mountDialog(type: 'page' | 'layout' = 'layout', stack: Record<string, any>[] = [{ iri: COMPONENT }, { iri: POSITION }, { iri: GROUP }, { iri: LAYOUT }]) {
  const { default: CloneTargetDialog } = await import('./CloneTargetDialog.vue')
  const wrapper = mount(CloneTargetDialog, {
    props: {
      stack,
      type,
    },
    global: {
      stubs: {
        DialogBox: {
          props: ['modelValue', 'buttons', 'title', 'isLoading'],
          emits: ['update:modelValue'],
          template: '<div v-if="modelValue" class="dialog-stub"><h3 class="dialog-title">{{ title }}</h3><slot /><button v-for="b of buttons" :key="b.label" class="dialog-button" @click="b.callbackFn ? b.callbackFn() : $emit(\'update:modelValue\', false)">{{ b.label }}</button></div>',
        },
        Spinner: { template: '<div class="spinner-stub" />' },
        CwaUiAlertWarning: { template: '<div class="alert-stub"><slot /></div>' },
      },
    },
  })
  await flushPromises()
  return wrapper
}

function dialogButton(wrapper: Awaited<ReturnType<typeof mountDialog>>, label: string) {
  return wrapper.findAll('.dialog-button').find(button => button.text() === label)
}

async function editLayout(wrapper: Awaited<ReturnType<typeof mountDialog>>) {
  await dialogButton(wrapper, 'Edit layout')!.trigger('click')
  await flushPromises()
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

  test('a layout target while already editing the layout says, without the switch warning, that it is shared by every page', async () => {
    startCloning()
    state.cwa.admin.resourceStackManager.isEditingLayout.value = true
    const wrapper = await mountDialog()
    const scope = wrapper.find('[data-testid="clone-scope"]')
    expect(scope.text()).toBe('Shared layout: this appears on every page')
    expect(scope.classes()).not.toContain('cwa:text-yellow')
  })

  test('a move patches the moved position instead of cloning', async () => {
    state.cwa = makeCwa()
    useCloneMode(state.cwa as Cwa).start(SOURCE, 'Source', { positionIri: '/_/component_positions/source', fromLayout: false })
    const { cloneComponent, moveComponent } = await import('#cwa/admin/clone-component')
    const wrapper = await mountDialog()
    await editLayout(wrapper)

    const addAfter = wrapper.findAll('[data-testid="clone-option"]').find(button => button.text() === 'Add after')!
    await addAfter.trigger('click')
    await flushPromises()

    expect(moveComponent).toHaveBeenCalledWith(state.cwa, {
      positionIri: '/_/component_positions/source',
      target: { kind: 'position', groupIri: GROUP, anchor: { after: POSITION } },
    })
    expect(cloneComponent).not.toHaveBeenCalled()
    expect(state.editingLayoutWhenCloned).toBe(true)
  })

  test('a move from the layout into the page warns that it will leave every other page', async () => {
    state.cwa = makeCwa()
    state.cwa.admin.resourceStackManager.isEditingLayout.value = true
    useCloneMode(state.cwa as Cwa).start(SOURCE, 'Source', { positionIri: '/_/component_positions/source', fromLayout: true })
    const wrapper = await mountDialog('page')
    await dialogButton(wrapper, 'Edit page')!.trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="move-leaves-layout"]').text()).toBe('This takes it out of the layout: it will no longer appear on other pages')
  })

  test('a clone gives no leave-the-layout warning', async () => {
    startCloning()
    state.cwa.admin.resourceStackManager.isEditingLayout.value = true
    const wrapper = await mountDialog('page')
    await dialogButton(wrapper, 'Edit page')!.trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="clone-option"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="move-leaves-layout"]').exists()).toBe(false)
  })

  test('a layout target switches to layout editing before adding', async () => {
    startCloning()
    const { cloneComponent } = await import('#cwa/admin/clone-component')
    const wrapper = await mountDialog()
    await editLayout(wrapper)

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

    await editLayout(wrapper)
    await dialogButton(wrapper, 'Cancel')!.trigger('click')

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
      expect(wrapper.text().split('This group is full')).toHaveLength(2)
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

  describe('the title names the anchor (#414)', () => {
    test.each([
      ['a clone', undefined, 'Clone next to “Third page component”'],
      ['a move', { positionIri: '/_/component_positions/source', fromLayout: false }, 'Move next to “Third page component”'],
    ] as const)('in %s, by an excerpt of its content', async (_label, move, title) => {
      state.cwa = makeCwa()
      state.cwa.admin.resourceStackManager.isEditingLayout.value = true
      useCloneMode(state.cwa as Cwa).start(SOURCE, 'Source', move)
      const elements = { value: [textElement(' Third page\n component ')] }
      const wrapper = await mountDialog('layout', [{ iri: COMPONENT, displayName: 'Body Text', domElements: elements }, { iri: POSITION, domElements: elements }, { iri: GROUP }, { iri: LAYOUT }])

      expect(wrapper.find('.dialog-title').text()).toBe(title)
    })

    test('by its type when it has no text, as for an image', async () => {
      startCloning()
      state.cwa.admin.resourceStackManager.isEditingLayout.value = true
      const elements = { value: [document.createElement('img')] }
      const wrapper = await mountDialog('layout', [{ iri: COMPONENT, displayName: 'Image', domElements: elements }, { iri: POSITION, domElements: elements }, { iri: GROUP }, { iri: LAYOUT }])

      expect(wrapper.find('.dialog-title').text()).toBe('Clone next to Image')
    })

    test('a clicked group is titled Clone Here, as there is no component to be next to', async () => {
      startCloning()
      state.cwa.admin.resourceStackManager.isEditingLayout.value = true
      const wrapper = await mountDialog('layout', [{ iri: GROUP }, { iri: LAYOUT }])

      expect(wrapper.find('.dialog-title').text()).toBe('Clone Here')
    })
  })

  describe('switching scope (#414)', () => {
    test('asks "Edit the shared layout?" with Edit layout and Cancel before showing a layout target\'s options', async () => {
      startCloning()
      const wrapper = await mountDialog()

      expect(wrapper.find('.dialog-title').text()).toBe('Edit the shared layout?')
      expect(wrapper.findAll('.dialog-button').map(button => button.text())).toEqual(['Edit layout', 'Cancel'])
      expect(wrapper.find('[data-testid="clone-option"]').exists()).toBe(false)

      await editLayout(wrapper)

      expect(wrapper.find('[data-testid="clone-option"]').exists()).toBe(true)
      expect(wrapper.findAll('.dialog-button').map(button => button.text())).toEqual(['Cancel'])
      expect(state.cwa.admin.resourceStackManager.isEditingLayout.value).toBe(false)
    })

    test('Cancel on the scope question closes the dialog, sends nothing and leaves the scope', async () => {
      const cloneMode = startCloning()
      const { cloneComponent } = await import('#cwa/admin/clone-component')
      const wrapper = await mountDialog()

      await dialogButton(wrapper, 'Cancel')!.trigger('click')

      expect(wrapper.emitted('close')).toHaveLength(1)
      expect(cloneComponent).not.toHaveBeenCalled()
      expect(cloneMode.source.value).toBeDefined()
      expect(state.cwa.admin.resourceStackManager.isEditingLayout.value).toBe(false)
    })

    test('asks "Edit the page?" with Edit page when switching from the layout to the page', async () => {
      startCloning()
      state.cwa.admin.resourceStackManager.isEditingLayout.value = true
      const wrapper = await mountDialog('page')

      expect(wrapper.find('.dialog-title').text()).toBe('Edit the page?')
      expect(wrapper.findAll('.dialog-button').map(button => button.text())).toEqual(['Edit page', 'Cancel'])
    })

    test('does not ask when no option would be enabled, and says why once with the type\'s display name', async () => {
      startCloning()
      byId[GROUP]!.allowedComponents = ['/component/navigation_links']
      try {
        const wrapper = await mountDialog()

        expect(wrapper.find('.dialog-title').text()).not.toBe('Edit the shared layout?')
        const options = wrapper.findAll('[data-testid="clone-option"]')
        expect(options.map(option => option.attributes('disabled'))).toEqual(['', ''])
        expect(wrapper.get('[data-testid="clone-reasons"]').text()).toBe('This group does not allow Body Text')
        expect(wrapper.text().split('does not allow')).toHaveLength(2)
        expect(wrapper.text()).not.toContain('HtmlContent')
      }
      finally {
        delete byId[GROUP]!.allowedComponents
      }
    })
  })

  test('an enabled option is styled apart from a disabled one, not only by opacity (#414)', async () => {
    state.cwa = makeCwa()
    state.cwa.admin.resourceStackManager.isEditingLayout.value = true
    useCloneMode(state.cwa as Cwa).start(SOURCE, 'Source', { positionIri: POSITION, fromLayout: true })
    const wrapper = await mountDialog('layout', [{ iri: GROUP }, { iri: LAYOUT }])

    const [toStart, toEnd] = wrapper.findAll('[data-testid="clone-option"]')
    expect(toStart!.attributes('disabled')).toBeDefined()
    expect(toEnd!.attributes('disabled')).toBeUndefined()
    const enabledOnly = toEnd!.classes().filter(name => !toStart!.classes().includes(name))
    const disabledOnly = toStart!.classes().filter(name => !toEnd!.classes().includes(name))
    expect(enabledOnly).toEqual(expect.arrayContaining(['cwa:bg-stone-700', 'cwa:text-white', 'cwa:border-stone-400']))
    expect(disabledOnly).toEqual(expect.arrayContaining(['cwa:border-dashed', 'cwa:bg-transparent']))
  })

  test('Use here on a page-data slot holding another component warns that it replaces it (#415)', async () => {
    startCloning()
    state.cwa.resources.isDataPage = computed(() => true)
    const wrapper = await mountDialog('page', [{ iri: DYNAMIC }, { iri: PAGE }])

    const useHere = wrapper.findAll('[data-testid="clone-option"]').find(button => button.text() === 'Use here')!
    expect(useHere.attributes('disabled')).toBeUndefined()
    expect(wrapper.get('[data-testid="clone-option-warning"]').text()).toBe('This replaces Body Text')
  })
})
