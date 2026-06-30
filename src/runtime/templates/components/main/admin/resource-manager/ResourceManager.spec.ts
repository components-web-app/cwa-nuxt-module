// @vitest-environment happy-dom
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { ref, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { CwaUserRoles } from '#cwa/storage/stores/auth/state'

// --- Hoisted mocks -----------------------------------------------------------
// useDataResolver is heavy (creates Vue apps via internals) — stub it out and
// capture the args so we can drive `allTabsMeta` manually.
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

// --- Shared mutable $cwa mock ------------------------------------------------
const cwaState = vi.hoisted(() => ({ cwa: null as any }))

const { useCwa } = vi.hoisted(() => ({
  useCwa: vi.fn(() => cwaState.cwa),
}))

mockNuxtImport('useCwa', () => useCwa)

// --- Helpers -----------------------------------------------------------------
function makeStackManager(overrides: Record<string, any> = {}) {
  return {
    currentStackItem: ref<any>(null),
    showManager: ref(false),
    isContextPopulating: ref(true),
    isPopulating: ref(false),
    completeStack: vi.fn(),
    selectStackIndex: vi.fn(),
    resetTabs: vi.fn(),
    ...overrides,
  }
}

function makeCwa(opts: {
  isEditing?: boolean
  hasRole?: boolean
  stackManager?: ReturnType<typeof makeStackManager>
} = {}) {
  const stackManager = opts.stackManager ?? makeStackManager()
  return {
    admin: {
      isEditing: opts.isEditing ?? false,
      resourceStackManager: stackManager,
      emitRedraw: vi.fn(),
    },
    auth: {
      hasRole: vi.fn((role: string) => (opts.hasRole ?? false) && role === CwaUserRoles.ADMIN),
    },
    resources: {
      isIriPublishableEquivalent: vi.fn(() => false),
    },
  }
}

async function mountManager() {
  // Import after mocks are registered.
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
      // showSpacer checks `!!currentStackItem` against the Ref itself (not .value),
      // so it is effectively driven by showManager alone.
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

      // useDataResolver received the allTabsMeta ref — populate it.
      resolverState.allMeta.value = [{ component: 'Tab1' }]
      await nextTick()

      expect(wrapper.findComponent({ name: 'ManagerTabs' }).exists()).toBe(true)
      expect(wrapper.findComponent({ name: 'ManagerTabs' }).props('tabs')).toHaveLength(1)
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

      // index 0 selected initially → tabA
      expect((wrapper.vm as any).selectedTab.name).toBe('TabA')
      // ManagerTabs emits the new index via its click event → selectTab(1) → tabB
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
      // The onMounted mousedown listener stores e.target as mousedownTarget.
      const mousedownEvt = new MouseEvent('mousedown')
      Object.defineProperty(mousedownEvt, 'target', { value: el })
      window.dispatchEvent(mousedownEvt)

      // clickHandler with a matching target should proceed.
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
      // context menu model is now open
      expect(wrapper.findComponent({ name: 'CwaAdminResourceManagerContextMenu' }).props('modelValue')).toBe(true)
    })

    test('closes when the same position is clicked again while open (showDefaultContext)', async () => {
      const stackManager = makeStackManager({ isContextPopulating: ref(true) })
      cwaState.cwa = makeCwa({ isEditing: true, hasRole: true, stackManager })
      const wrapper = await mountManager()

      const evt = { clientX: 20, clientY: 30, preventDefault: vi.fn(), target: document.createElement('div') } as unknown as MouseEvent
      // first open
      ;(wrapper.vm as any).contextMenuHandler(evt, 'page')
      await nextTick()
      expect(wrapper.findComponent({ name: 'CwaAdminResourceManagerContextMenu' }).props('modelValue')).toBe(true)

      // second call at same position closes
      const evt2 = { clientX: 22, clientY: 31, preventDefault: vi.fn(), target: document.createElement('div') } as unknown as MouseEvent
      ;(wrapper.vm as any).contextMenuHandler(evt2, 'page')
      await nextTick()
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

      // populate then change item
      resolverState.allMeta.value = [{ component: 'x' }]
      stackManager.currentStackItem.value = { iri: '/component/2', managerTabs: [{ name: 'Y', render: () => null }] }
      await nextTick()

      // allTabsMeta reset to []
      expect(resolverState.allMeta.value).toEqual([])
      // currentManagerTabs (passed to resolver ops.components) updated to new tabs
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

      // unchanged because equivalent
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
