// @vitest-environment happy-dom
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, nextTick } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { CwaUserRoles } from '#cwa/storage/stores/auth/state'
import { useCloneMode } from '#cwa/admin/clone-mode'
import type Cwa from '#cwa/cwa'

vi.mock('#cwa/templates/components/main/admin/resource-manager/_parts/ClonePlacementMenu.vue', () => ({
  __esModule: true,
  default: {
    name: 'ClonePlacementMenu',
    props: ['stack', 'type', 'point'],
    template: '<div class="clone-placement-menu-stub" />',
  },
}))

const resolverState = vi.hoisted(() => ({
  allMeta: null as any,
  ops: null as any,
}))

vi.mock('#cwa/templates/components/core/useDataResolver', () => ({
  useDataResolver: vi.fn((allMeta: any, ops: any) => {
    resolverState.allMeta = allMeta
    resolverState.ops = ops
  }),
}))

vi.mock('#cwa/composables/transitions', () => ({
  useTransitions: () => ({ slideUp: {} }),
}))

const confirmState = vi.hoisted(() => ({ reveal: vi.fn(async () => ({ isCanceled: false })) }))

vi.mock('#cwa/admin/confirm-dialog', () => ({
  createConfirmDialog: vi.fn(async () => ({ reveal: confirmState.reveal })),
}))

vi.mock('#cwa/templates/components/core/ConfirmDialog.vue', () => ({ default: {} }))

vi.mock('#app/nuxt', async importOriginal => ({
  ...await importOriginal<typeof import('#app/nuxt')>(),
  useNuxtApp: () => ({ vueApp: {} }),
}))

const cwaState = vi.hoisted(() => ({ cwa: null as any }))

const { useCwa } = vi.hoisted(() => ({
  useCwa: vi.fn(() => cwaState.cwa),
}))

mockNuxtImport('useCwa', () => useCwa)

function makeStackManager(overrides: Record<string, any> = {}) {
  return {
    currentStackItem: ref<any>(null),
    showManager: ref(false),
    isContextPopulating: ref(true),
    isPopulating: ref(false),
    completeStack: vi.fn(),
    selectStackIndex: vi.fn(),
    restorePreviousStack: vi.fn(),
    resetStack: vi.fn(),
    isEditingLayout: ref(false),
    resourceStack: ref<{ iri: string }[]>([]),
    resetTabs: vi.fn(),
    ...overrides,
  }
}

function makeCwa(opts: {
  isEditing?: boolean
  hasRole?: boolean
  navigationGuardDisabled?: boolean
  stackManager?: ReturnType<typeof makeStackManager>
} = {}) {
  const stackManager = opts.stackManager ?? makeStackManager()
  return {
    admin: {
      isEditing: opts.isEditing ?? false,
      navigationGuardDisabled: opts.navigationGuardDisabled ?? false,
      setNavigationGuardDisabled: vi.fn(),
      resourceStackManager: stackManager,
      emitRedraw: vi.fn(),
    },
    auth: {
      user: { '@id': '/_/users/admin' },
      hasRole: vi.fn((role: string) => (opts.hasRole ?? false) && role === CwaUserRoles.ADMIN),
    },
    resources: {
      displayPageIri: { value: undefined },
      isIriPublishableEquivalent: vi.fn(() => false),
    },
  }
}

async function mountManager() {
  const { default: ResourceManager } = await import('./ResourceManager.vue')
  return mount(ResourceManager, {
    global: {
      stubs: {
        ResourceLoadingIndicator: { template: '<div class="rli-stub" />' },
        ManagerTabs: {
          name: 'ManagerTabs',
          props: ['tabs'],
          methods: { resetTabs() {} },
          template: '<div class="manager-tabs-stub" @click="$emit(\'click\', 1)" />',
        },
        CwaAdminResourceManagerContextMenu: {
          name: 'CwaAdminResourceManagerContextMenu',
          props: ['modelValue', 'virtualElement'],
          template: '<div class="context-menu-stub" />',
        },
        ResourceManagerCtaButton: { template: '<div class="cta-stub" />' },
        ComponentUsageBadge: { template: '<span class="usage-badge-stub" />' },
        SharedInstancesHighlight: { template: '<div class="shared-instances-stub" />' },
        PeerOutlines: { template: '<div class="peer-outlines-stub" />' },
        AddComponentDialog: { template: '<div class="add-dialog-stub" />' },
        Transition: false,
      },
    },
  })
}

describe('ResourceManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resolverState.allMeta = null
    resolverState.ops = null
  })

  afterEach(() => {
    cwaState.cwa && useCloneMode(cwaState.cwa as Cwa).end()
  })

  describe('showSpacer / showManager rendering', () => {
    test('does not render the manager or spacer when showManager is false', async () => {
      cwaState.cwa = makeCwa({ stackManager: makeStackManager({ showManager: ref(false) }) })
      const wrapper = await mountManager()
      expect(wrapper.find('#cwa-manager-spacer').exists()).toBe(false)
    })

    test('renders the spacer when showManager is true and there is a current stack item', async () => {
      const stackManager = makeStackManager({
        showManager: ref(true),
        currentStackItem: ref({ iri: '/component/1' }),
      })
      cwaState.cwa = makeCwa({ stackManager })
      const wrapper = await mountManager()
      expect(wrapper.find('#cwa-manager-spacer').exists()).toBe(true)
    })

    test('renders the spacer whenever showManager is true (currentStackItem ref is always truthy)', async () => {
      const stackManager = makeStackManager({
        showManager: ref(true),
        currentStackItem: ref(null),
      })
      cwaState.cwa = makeCwa({ stackManager })
      const wrapper = await mountManager()
      expect(wrapper.find('#cwa-manager-spacer').exists()).toBe(true)
    })
  })

  describe('manager tabs holder', () => {
    test('renders ManagerTabs and the selected tab when allTabsMeta is populated', async () => {
      const selectedTab = { name: 'SelectedTab', render: () => null }
      const stackManager = makeStackManager({
        showManager: ref(true),
        currentStackItem: ref({ iri: '/component/1', managerTabs: [selectedTab] }),
      })
      cwaState.cwa = makeCwa({ stackManager })
      const wrapper = await mountManager()

      resolverState.allMeta.value = [{ component: 'Tab1' }]
      await nextTick()

      expect(wrapper.findComponent({ name: 'ManagerTabs' }).exists()).toBe(true)
      expect(wrapper.findComponent({ name: 'ManagerTabs' }).props('tabs')).toHaveLength(1)
    })

    test('shows the usage badge directly to the left of the CTA, in the same row', async () => {
      const stackManager = makeStackManager({
        showManager: ref(true),
        currentStackItem: ref({ iri: '/component/1', managerTabs: [] }),
      })
      cwaState.cwa = makeCwa({ stackManager })
      const wrapper = await mountManager()

      resolverState.allMeta.value = [{ component: 'Tab1' }]
      await nextTick()

      const badge = wrapper.find('.usage-badge-stub')
      expect(badge.exists()).toBe(true)
      expect(badge.element.nextElementSibling?.classList.contains('cta-stub')).toBe(true)
    })

    test.each([
      ['a component', '/component/1', false, true],
      ['a position', '/_/component_positions/1', false, false],
      ['a component while cloning', '/component/1', true, false],
    ])('outlines the other copies of the selection only for %s outside clone mode', async (_label, iri, cloning, shown) => {
      const stackManager = makeStackManager({
        showManager: ref(true),
        currentStackItem: ref({ iri, managerTabs: [] }),
      })
      cwaState.cwa = makeCwa({ stackManager })
      cloning && useCloneMode(cwaState.cwa).start('/component/source')
      const wrapper = await mountManager()
      await flushPromises()

      expect(wrapper.find('.shared-instances-stub').exists()).toBe(shown)
      cloning && useCloneMode(cwaState.cwa).end()
    })

    test.each([
      ['editing', true, false, true],
      ['not editing', false, false, false],
      ['cloning', true, true, false],
    ])('outlines what other admins have selected only while %s (#429)', async (_label, isEditing, cloning, shown) => {
      cwaState.cwa = makeCwa({ isEditing })
      cloning && useCloneMode(cwaState.cwa).start('/component/source')
      const wrapper = await mountManager()
      await flushPromises()

      expect(wrapper.find('.peer-outlines-stub').exists()).toBe(shown)
      cloning && useCloneMode(cwaState.cwa).end()
    })

    test('does not render the holder when allTabsMeta is empty', async () => {
      const stackManager = makeStackManager({
        showManager: ref(true),
        currentStackItem: ref({ iri: '/component/1', managerTabs: [] }),
      })
      cwaState.cwa = makeCwa({ stackManager })
      const wrapper = await mountManager()
      expect(wrapper.findComponent({ name: 'ManagerTabs' }).exists()).toBe(false)
    })
  })

  describe('admin context menu visibility', () => {
    test('renders the context menu when the user has the ADMIN role', async () => {
      cwaState.cwa = makeCwa({ hasRole: true })
      const wrapper = await mountManager()
      expect(wrapper.findComponent({ name: 'CwaAdminResourceManagerContextMenu' }).exists()).toBe(true)
    })

    test('hides the context menu when the user lacks the ADMIN role', async () => {
      cwaState.cwa = makeCwa({ hasRole: false })
      const wrapper = await mountManager()
      expect(wrapper.findComponent({ name: 'CwaAdminResourceManagerContextMenu' }).exists()).toBe(false)
    })
  })

  describe('selectTab', () => {
    test('clicking ManagerTabs updates the selected tab index', async () => {
      const tabA = { name: 'TabA', render: () => null }
      const tabB = { name: 'TabB', render: () => null }
      const stackManager = makeStackManager({
        showManager: ref(true),
        currentStackItem: ref({ iri: '/component/1', managerTabs: [tabA, tabB] }),
      })
      cwaState.cwa = makeCwa({ stackManager })
      const wrapper = await mountManager()
      resolverState.allMeta.value = [{ component: 'a' }, { component: 'b' }]
      await nextTick()

      expect((wrapper.vm as any).selectedTab.name).toBe('TabA')
      await wrapper.findComponent({ name: 'ManagerTabs' }).vm.$emit('click', 1)
      await nextTick()
      expect((wrapper.vm as any).selectedTab.name).toBe('TabB')
    })
  })

  describe('clickHandler', () => {
    test('completes the stack and selects index 0 when target matches mousedown target', async () => {
      const stackManager = makeStackManager({ isPopulating: ref(false) })
      cwaState.cwa = makeCwa({ stackManager })
      const wrapper = await mountManager()

      const el = document.createElement('div')
      const mousedownEvt = new MouseEvent('mousedown')
      Object.defineProperty(mousedownEvt, 'target', { value: el })
      window.dispatchEvent(mousedownEvt)

      const evt = { target: el } as unknown as MouseEvent
      ;(wrapper.vm as any).clickHandler(evt, 'page')

      expect(stackManager.completeStack).toHaveBeenCalledWith({ clickTarget: el }, false, 'page')
      expect(stackManager.selectStackIndex).toHaveBeenCalledWith(0, false)
    })

    test('bails out when target differs from mousedown target and not populating', async () => {
      const stackManager = makeStackManager({ isPopulating: ref(false) })
      cwaState.cwa = makeCwa({ stackManager })
      const wrapper = await mountManager()

      const evt = { target: document.createElement('span') } as unknown as MouseEvent
      ;(wrapper.vm as any).clickHandler(evt, 'page')

      expect(stackManager.completeStack).not.toHaveBeenCalled()
      expect(stackManager.selectStackIndex).not.toHaveBeenCalled()
    })

    test('proceeds when populating even if targets differ', async () => {
      const stackManager = makeStackManager({ isPopulating: ref(true) })
      cwaState.cwa = makeCwa({ stackManager })
      const wrapper = await mountManager()

      const evt = { target: document.createElement('span') } as unknown as MouseEvent
      ;(wrapper.vm as any).clickHandler(evt, 'layout')

      expect(stackManager.completeStack).toHaveBeenCalledWith({ clickTarget: evt.target }, false, 'layout')
      expect(stackManager.selectStackIndex).toHaveBeenCalledWith(0, false)
    })

    const clonedStack = [{ iri: '/component/target' }, { iri: '/_/component_positions/p1' }, { iri: '/_/component_groups/g1' }]

    async function clickInCloneMode(opts: { navigationGuardDisabled?: boolean, stack?: { iri: string }[] } = {}) {
      const stackManager = makeStackManager({ isPopulating: ref(true), resourceStack: ref(opts.stack ?? clonedStack) })
      cwaState.cwa = makeCwa({ isEditing: true, stackManager, navigationGuardDisabled: opts.navigationGuardDisabled })
      useCloneMode(cwaState.cwa as Cwa).start('/component/source', 'Source')
      const wrapper = await mountManager()
      ;(wrapper.vm as any).clickHandler({ target: document.createElement('span'), clientX: 310, clientY: 420 } as unknown as MouseEvent, 'layout')
      await flushPromises()
      return { wrapper, stackManager }
    }

    test('in clone mode a click opens the placement menu at the click point instead of selecting, keeping the selection and the scope, so the menu decides whether to ask about switching scope (#426)', async () => {
      const { wrapper, stackManager } = await clickInCloneMode()

      expect(stackManager.completeStack).toHaveBeenCalledWith({ clickTarget: expect.any(HTMLElement) }, false, 'layout')
      expect(stackManager.selectStackIndex).not.toHaveBeenCalled()
      expect(stackManager.restorePreviousStack).toHaveBeenCalled()
      expect(confirmState.reveal).not.toHaveBeenCalled()
      expect(stackManager.isEditingLayout.value).toBe(false)
      const menu = wrapper.findComponent({ name: 'ClonePlacementMenu' })
      expect(menu.exists()).toBe(true)
      expect(menu.props()).toEqual({ stack: clonedStack, type: 'layout', point: { x: 310, y: 420 } })
    })

    test('in clone mode with navigation enabled a click only navigates: no selection, confirm or menu', async () => {
      const { wrapper, stackManager } = await clickInCloneMode({ navigationGuardDisabled: true })

      expect(stackManager.selectStackIndex).not.toHaveBeenCalled()
      expect(confirmState.reveal).not.toHaveBeenCalled()
      expect(stackManager.restorePreviousStack).toHaveBeenCalled()
      expect(wrapper.findComponent({ name: 'ClonePlacementMenu' }).exists()).toBe(false)
    })

    test('in clone mode a click on nothing opens no menu and selects nothing', async () => {
      const { wrapper, stackManager } = await clickInCloneMode({ stack: [] })

      expect(stackManager.selectStackIndex).not.toHaveBeenCalled()
      expect(wrapper.findComponent({ name: 'ClonePlacementMenu' }).exists()).toBe(false)
    })

    test('a click on another target while the menu is open opens a fresh menu at the new point (#426)', async () => {
      const { wrapper } = await clickInCloneMode()
      const first = wrapper.findComponent({ name: 'ClonePlacementMenu' }).vm

      ;(wrapper.vm as any).clickHandler({ target: document.createElement('span'), clientX: 40, clientY: 50 } as unknown as MouseEvent, 'page')
      await flushPromises()

      const menu = wrapper.findComponent({ name: 'ClonePlacementMenu' })
      expect(menu.vm).not.toBe(first)
      expect(menu.props()).toEqual({ stack: clonedStack, type: 'page', point: { x: 40, y: 50 } })
    })

    test('closing the placement menu removes it', async () => {
      const { wrapper } = await clickInCloneMode()

      wrapper.findComponent({ name: 'ClonePlacementMenu' }).vm.$emit('close')
      await flushPromises()

      expect(wrapper.findComponent({ name: 'ClonePlacementMenu' }).exists()).toBe(false)
    })
  })

  describe('contextMenuHandler', () => {
    test('does nothing (closes) when not editing', async () => {
      const stackManager = makeStackManager({ isContextPopulating: ref(true) })
      cwaState.cwa = makeCwa({ isEditing: false, stackManager })
      const wrapper = await mountManager()

      const preventDefault = vi.fn()
      const evt = { clientX: 5, clientY: 5, preventDefault, target: document.createElement('div') } as unknown as MouseEvent
      ;(wrapper.vm as any).contextMenuHandler(evt, 'page')

      expect(preventDefault).not.toHaveBeenCalled()
      expect(stackManager.completeStack).not.toHaveBeenCalled()
    })

    test('does nothing when context is not populating', async () => {
      const stackManager = makeStackManager({ isContextPopulating: ref(false) })
      cwaState.cwa = makeCwa({ isEditing: true, stackManager })
      const wrapper = await mountManager()

      const preventDefault = vi.fn()
      const evt = { clientX: 5, clientY: 5, preventDefault, target: document.createElement('div') } as unknown as MouseEvent
      ;(wrapper.vm as any).contextMenuHandler(evt, 'page')

      expect(preventDefault).not.toHaveBeenCalled()
      expect(stackManager.completeStack).not.toHaveBeenCalled()
    })

    test('opens the context menu when editing and context populating', async () => {
      const stackManager = makeStackManager({ isContextPopulating: ref(true) })
      cwaState.cwa = makeCwa({ isEditing: true, hasRole: true, stackManager })
      const wrapper = await mountManager()

      const preventDefault = vi.fn()
      const evt = { clientX: 20, clientY: 30, preventDefault, target: document.createElement('div') } as unknown as MouseEvent
      ;(wrapper.vm as any).contextMenuHandler(evt, 'page')

      await nextTick()
      expect(preventDefault).toHaveBeenCalled()
      expect(stackManager.completeStack).toHaveBeenCalledWith({ clickTarget: evt.target }, true, 'page')
      expect(wrapper.findComponent({ name: 'CwaAdminResourceManagerContextMenu' }).props('modelValue')).toBe(true)
    })

    test('closes when the same position is clicked again while open (showDefaultContext)', async () => {
      const stackManager = makeStackManager({ isContextPopulating: ref(true) })
      cwaState.cwa = makeCwa({ isEditing: true, hasRole: true, stackManager })
      const wrapper = await mountManager()

      const evt = { clientX: 20, clientY: 30, preventDefault: vi.fn(), target: document.createElement('div') } as unknown as MouseEvent
      ;(wrapper.vm as any).contextMenuHandler(evt, 'page')
      await nextTick()
      expect(wrapper.findComponent({ name: 'CwaAdminResourceManagerContextMenu' }).props('modelValue')).toBe(true)

      const evt2 = { clientX: 22, clientY: 31, preventDefault: vi.fn(), target: document.createElement('div') } as unknown as MouseEvent
      ;(wrapper.vm as any).contextMenuHandler(evt2, 'page')
      await nextTick()
      expect(wrapper.findComponent({ name: 'CwaAdminResourceManagerContextMenu' }).props('modelValue')).toBe(false)
    })
  })

  describe('contextMenuHandler in clone mode', () => {
    test.each([false, true])('a right-click never selects or opens the CWA menu, and leaves the browser menu (navigation enabled: %s)', async (navigationGuardDisabled) => {
      const stackManager = makeStackManager({ isContextPopulating: ref(true) })
      cwaState.cwa = makeCwa({ isEditing: true, hasRole: true, stackManager, navigationGuardDisabled })
      useCloneMode(cwaState.cwa as Cwa).start('/component/source', 'Source')
      const wrapper = await mountManager()

      const preventDefault = vi.fn()
      const evt = { clientX: 20, clientY: 30, preventDefault, target: document.createElement('div') } as unknown as MouseEvent
      ;(wrapper.vm as any).contextMenuHandler(evt, 'layout')
      await nextTick()

      expect(preventDefault).not.toHaveBeenCalled()
      expect(stackManager.completeStack).not.toHaveBeenCalled()
      expect(stackManager.resetStack).toHaveBeenCalledWith(true)
      expect(stackManager.selectStackIndex).not.toHaveBeenCalled()
      expect(wrapper.findComponent({ name: 'CwaAdminResourceManagerContextMenu' }).props('modelValue')).toBe(false)
    })
  })

  describe('closeContextMenu', () => {
    test('sets isOpen false and completes stack with undefined type as context', async () => {
      const stackManager = makeStackManager()
      cwaState.cwa = makeCwa({ stackManager })
      const wrapper = await mountManager()

      const evt = { target: document.createElement('div') } as unknown as MouseEvent
      ;(wrapper.vm as any).closeContextMenu(evt)

      expect(stackManager.completeStack).toHaveBeenCalledWith({ clickTarget: evt.target }, true, undefined)
    })
  })

  describe('currentStackItem watcher', () => {
    test('resets tabs and updates currentManagerTabs when the stack item changes to a non-equivalent iri', async () => {
      const stackManager = makeStackManager({
        showManager: ref(true),
        currentStackItem: ref({ iri: '/component/1', managerTabs: [{ name: 'X', render: () => null }] }),
      })
      const cwa = makeCwa({ stackManager })
      cwa.resources.isIriPublishableEquivalent = vi.fn(() => false)
      cwaState.cwa = cwa
      await mountManager()

      resolverState.allMeta.value = [{ component: 'x' }]
      stackManager.currentStackItem.value = { iri: '/component/2', managerTabs: [{ name: 'Y', render: () => null }] }
      await nextTick()

      expect(resolverState.allMeta.value).toEqual([])
      expect(resolverState.ops.components.value).toEqual([{ name: 'Y', render: expect.any(Function) }])
    })

    test('does not reset when old and new iri are publishable-equivalent', async () => {
      const stackManager = makeStackManager({
        showManager: ref(true),
        currentStackItem: ref({ iri: '/component/1', managerTabs: [{ name: 'X', render: () => null }] }),
      })
      const cwa = makeCwa({ stackManager })
      cwa.resources.isIriPublishableEquivalent = vi.fn(() => true)
      cwaState.cwa = cwa
      await mountManager()

      resolverState.allMeta.value = [{ component: 'x' }]
      stackManager.currentStackItem.value = { iri: '/component/1-draft', managerTabs: [{ name: 'Y', render: () => null }] }
      await nextTick()

      expect(resolverState.allMeta.value).toEqual([{ component: 'x' }])
    })
  })

  describe('useDataResolver wiring', () => {
    test('propsValidator returns true only when iri is present', async () => {
      const stackManager = makeStackManager({
        showManager: ref(true),
        currentStackItem: ref({ iri: '/component/1' }),
      })
      cwaState.cwa = makeCwa({ stackManager })
      await mountManager()

      const { propsValidator } = resolverState.ops
      expect(propsValidator({ iri: '/component/1' })).toBe(true)
      expect(propsValidator({ iri: undefined })).toBe(false)
    })

    test('resolver props track the current stack item iri', async () => {
      const stackManager = makeStackManager({
        showManager: ref(true),
        currentStackItem: ref({ iri: '/component/1' }),
      })
      cwaState.cwa = makeCwa({ stackManager })
      await mountManager()

      expect(resolverState.ops.props.value).toEqual({ iri: '/component/1' })
      stackManager.currentStackItem.value = { iri: '/component/9' }
      await nextTick()
      expect(resolverState.ops.props.value).toEqual({ iri: '/component/9' })
    })
  })

  describe('lifecycle listeners', () => {
    test('registers and removes the resize listener', async () => {
      const addSpy = vi.spyOn(window, 'addEventListener')
      const removeSpy = vi.spyOn(window, 'removeEventListener')
      const cwa = makeCwa()
      cwaState.cwa = cwa
      const wrapper = await mountManager()

      expect(addSpy).toHaveBeenCalledWith('resize', cwa.admin.emitRedraw, false)
      expect(addSpy).toHaveBeenCalledWith('mousedown', expect.any(Function))

      wrapper.unmount()
      expect(removeSpy).toHaveBeenCalledWith('resize', cwa.admin.emitRedraw)
    })
  })
})
