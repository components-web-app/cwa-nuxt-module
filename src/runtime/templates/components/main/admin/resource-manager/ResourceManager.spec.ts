// @vitest-environment happy-dom
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { createCommentVNode, defineAsyncComponent, h, inject, onMounted, reactive, ref, nextTick } from 'vue'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { CwaUserRoles } from '#cwa/storage/stores/auth/state'
import { useCloneMode } from '#cwa/admin/clone-mode'
import type Cwa from '#cwa/cwa'
import { announceKey } from '#cwa/templates/components/core/ui/field-keys'
import { consola } from 'consola'
import CwaUiManagerTab from '#cwa/templates/components/ui/ManagerTab.vue'
import Group from './_tabs/group/Group.vue'

vi.mock('#cwa/templates/components/main/admin/resource-manager/_parts/ClonePlacementMenu.vue', () => ({
  __esModule: true,
  default: {
    name: 'ClonePlacementMenu',
    props: ['stack', 'type', 'point', 'link'],
    template: '<div class="clone-placement-menu-stub" />',
  },
}))

vi.mock('#cwa/templates/components/main/admin/resource-manager/_parts/LinkMenu.vue', () => ({
  __esModule: true,
  default: {
    name: 'LinkMenu',
    props: ['stack', 'type', 'point', 'link'],
    template: '<div class="link-menu-stub" />',
  },
}))

enableAutoUnmount(afterEach)

const selectOriginal = vi.hoisted(() => ({ fn: (() => {}) as (index: number) => void }))

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

vi.mock('#cwa/templates/components/core/ui/Confirm.vue', () => ({ default: {} }))

vi.mock('#app/nuxt', async importOriginal => ({
  ...await importOriginal<typeof import('#app/nuxt')>(),
  useNuxtApp: () => ({ vueApp: {} }),
}))

const cwaState = vi.hoisted(() => ({ cwa: null as any }))

const { useCwa } = vi.hoisted(() => ({
  useCwa: vi.fn(() => cwaState.cwa),
}))

mockNuxtImport('useCwa', () => useCwa)
vi.mock('#cwa/composables/cwa', () => ({ useCwa: () => cwaState.cwa }))

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
    contextStack: ref<{ iri: string, displayName?: string }[]>([{ iri: '/component/1', displayName: 'Rich text' }, { iri: '/_/pages/home' }]),
    currentIri: ref<string | undefined>('/component/1'),
    resetTabs: vi.fn(),
    getState: vi.fn(),
    getClosestStackItemByType: vi.fn(),
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
      user: { '@id': '/_/users/admin' },
      hasRole: vi.fn((role: string) => (opts.hasRole ?? false) && role === CwaUserRoles.ADMIN),
    },
    resources: {
      displayPageIri: { value: undefined },
      isIriPublishableEquivalent: vi.fn(() => false),
      getResource: vi.fn(() => ({ value: undefined })),
    },
  }
}

async function mountManager(attachTo?: HTMLElement) {
  const { default: ResourceManager } = await import('./ResourceManager.vue')
  return mount(ResourceManager, {
    attachTo,
    global: {
      stubs: {
        ResourceLoadingIndicator: { template: '<div class="rli-stub" />' },
        ManagerTabs: {
          name: 'ManagerTabs',
          props: ['tabs', 'idPrefix', 'label'],
          methods: { resetTabs() {}, selectOriginal: (index: number) => selectOriginal.fn(index) },
          template: '<div class="manager-tabs-stub" @click="$emit(\'click\', 1)"><button v-for="(tab, index) of tabs" :id="`${idPrefix}-tab-${index}`" type="button">{{ tab.name }}</button></div>',
        },
        CwaAdminResourceManagerContextMenu: {
          name: 'CwaAdminResourceManagerContextMenu',
          props: ['modelValue', 'point'],
          template: '<div class="context-menu-stub" />',
        },
        ResourceManagerCtaButton: { template: '<div class="cta-stub" />' },
        BarSummary: { name: 'BarSummary', props: ['message'], emits: ['show'], template: '<span class="bar-summary-stub" />' },
        ComponentUsageBadge: { template: '<span class="usage-badge-stub" />' },
        SharedInstancesHighlight: { template: '<div class="shared-instances-stub" />' },
        PeerOutlines: { template: '<div class="peer-outlines-stub" />' },
        HoverOutline: { template: '<div class="hover-outline-stub" />' },
        ReorderHandles: { name: 'ReorderHandles', props: ['groupIri'], template: '<div class="reorder-handles-stub" />' },
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

    test('the saving line above the bar sits on the notifications layer, above the page overlay and outlines, as the header\'s does', async () => {
      const stackManager = makeStackManager({ showManager: ref(true), currentStackItem: ref({ iri: '/component/1' }) })
      cwaState.cwa = makeCwa({ stackManager })
      const wrapper = await mountManager()
      resolverState.allMeta.value = [{ name: 'Tab' }]
      await nextTick()
      const line = wrapper.get('.rli-stub')
      expect(line.classes()).toContain('cwa:z-notifications')
      expect(line.classes()).toContain('cwa:bottom-full')
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

    test.each([
      ['editing', true, false, true],
      ['not editing', false, false, false],
      ['cloning', true, true, true],
    ])('outlines the component under the pointer only while %s', async (_label, isEditing, cloning, shown) => {
      cwaState.cwa = makeCwa({ isEditing })
      cloning && useCloneMode(cwaState.cwa).start('/component/source')
      const wrapper = await mountManager()
      await flushPromises()

      expect(wrapper.find('.hover-outline-stub').exists()).toBe(shown)
      cloning && useCloneMode(cwaState.cwa).end()
    })

    test('the pinned status sits in the tab row ahead of the usage badge and the CTA, and voices what a tab announces, so the region outlives the tab (#459)', async () => {
      const AnnouncingTab = {
        name: 'AnnouncingTab',
        setup() {
          const announce = inject(announceKey)!
          onMounted(() => announce('Set to 6, the highest position'))
          return () => h('div')
        },
      }
      const stackManager = makeStackManager({
        showManager: ref(true),
        currentStackItem: ref({ iri: '/component/1', managerTabs: [AnnouncingTab] }),
      })
      cwaState.cwa = makeCwa({ stackManager })
      const wrapper = await mountManager()
      resolverState.allMeta.value = [{ name: 'Tab' }]
      await nextTick()
      await new Promise(resolve => setTimeout(resolve, 150))

      const pin = wrapper.get('[data-testid="manager-pin"]')
      expect(pin.element.firstElementChild?.classList.contains('bar-summary-stub')).toBe(true)
      expect(pin.find('.usage-badge-stub').exists()).toBe(true)
      expect(wrapper.findComponent({ name: 'BarSummary' }).props('message')).toBe('Set to 6, the highest position')
    })

    test('the tab row is the control height every field shares plus the CTA inset and the bar\'s line, the hit size on touch, the row below takes the rest of the bar\'s height so it never changes, and the CTA group\'s and the tab group\'s one inset is 0 on touch and below 40rem (#459)', async () => {
      cwaState.cwa = makeCwa({ stackManager: makeStackManager({ showManager: ref(true), currentStackItem: ref({ iri: '/component/1', managerTabs: [] }) }) })
      const wrapper = await mountManager()
      resolverState.allMeta.value = [{ name: 'Tab' }]
      await nextTick()

      expect(wrapper.get('[data-testid="manager-bar"]').classes()).toContain('cwa:pointer-coarse:[--cwa-spacing-manager:7rem]')
      expect(wrapper.get('[data-testid="manager-bar"]').classes().filter(c => /manager-(tabs|row)/.test(c))).toEqual([])
      const holder = wrapper.get('[data-testid="manager-pin"]').element.parentElement!
      expect(holder.classList).toContain('cwa:[--cwa-spacing-manager-tabs:calc(var(--cwa-spacing-control)+2*var(--cwa-spacing-cta-inset)+1px)]')
      expect(holder.classList).toContain('cwa:pointer-coarse:[--cwa-spacing-manager-tabs:calc(var(--cwa-spacing-hit)+1px)]')
      expect(holder.classList).toContain('cwa:[--cwa-spacing-manager-row:calc(var(--cwa-spacing-manager)-var(--cwa-spacing-manager-tabs))]')
      expect(wrapper.get('[data-testid="manager-pin"]').classes()).toEqual(expect.arrayContaining([
        'cwa:pt-cta-inset',
        'cwa:pr-cta-inset',
        'cwa:gap-cta-inset',
      ]))
      const tabs = wrapper.get('.manager-tabs-stub').element
      expect(tabs.classList).toContain('cwa:box-border')
      expect(tabs.classList).toContain('cwa:pt-cta-inset')
      expect(tabs.classList).toContain('cwa:pb-[calc(var(--cwa-spacing-cta-inset)+1px)]')
      expect(tabs.parentElement!.classList).not.toContain('cwa:pt-cta-inset')
      const row = wrapper.get('[data-testid="manager-pin"]').element.parentElement!
      expect(row.contains(tabs)).toBe(true)
      expect(row.classList).toContain('cwa:pointer-coarse:[--cwa-spacing-cta-inset:0px]')
      expect(row.classList).toContain('cwa:@max-[40rem]:[--cwa-spacing-cta-inset:0px]')
    })

    test('showing a field from the status selects the tab that holds it and focuses its control (#459)', async () => {
      const calls: number[] = []
      selectOriginal.fn = index => calls.push(index)
      const FieldTab = { name: 'FieldTab', render: () => h('div', { 'data-cwa-field': 'title' }, [h('input', { 'data-testid': 'title-input' })]) }
      const stackManager = makeStackManager({
        showManager: ref(true),
        currentStackItem: ref({ iri: '/component/1', managerTabs: [FieldTab, FieldTab] }),
      })
      cwaState.cwa = makeCwa({ stackManager })
      const wrapper = await mountManager(document.body)
      resolverState.allMeta.value = [{ name: 'Publish', fields: [] }, { name: 'Content', fields: ['title'] }]
      await nextTick()

      wrapper.findComponent({ name: 'BarSummary' }).vm.$emit('show', 'title')
      await flushPromises()

      expect(calls).toEqual([1])
      expect(document.activeElement).toBe(wrapper.get('[data-testid="title-input"]').element)
      wrapper.unmount()
    })

    test('the shown tab is a tabpanel labelled by the selected tab, and the tablist is named for the selection (#461)', async () => {
      const FieldTab = { name: 'FieldTab', render: () => h('div') }
      const stackManager = makeStackManager({
        showManager: ref(true),
        currentStackItem: ref({ iri: '/component/1', displayName: 'Body Text', managerTabs: [FieldTab, FieldTab] }),
      })
      cwaState.cwa = makeCwa({ stackManager })
      const wrapper = await mountManager()
      resolverState.allMeta.value = [{ name: 'Publish', fields: [] }, { name: 'Content', fields: [] }]
      await nextTick()

      const tabs = wrapper.findComponent({ name: 'ManagerTabs' })
      const prefix = tabs.props('idPrefix') as string
      expect(prefix).toBeTruthy()
      expect(tabs.props('label')).toBe('Body Text settings')
      const panel = wrapper.get('[data-testid="manager-tab-panel"]')
      expect(panel.attributes('role')).toBe('tabpanel')
      expect(panel.attributes('id')).toBe(`${prefix}-panel`)
      expect(panel.attributes('aria-labelledby')).toBe(`${prefix}-tab-0`)

      tabs.vm.$emit('click', 1)
      await nextTick()
      expect(panel.attributes('aria-labelledby')).toBe(`${prefix}-tab-1`)
      wrapper.unmount()
    })

    test('a selection with no display name names its tablist Settings (#461)', async () => {
      const stackManager = makeStackManager({
        showManager: ref(true),
        currentStackItem: ref({ iri: '/component/1', managerTabs: [{ name: 'FieldTab', render: () => h('div') }] }),
      })
      cwaState.cwa = makeCwa({ stackManager })
      const wrapper = await mountManager()
      resolverState.allMeta.value = [{ name: 'Publish', fields: [] }]
      await nextTick()

      expect(wrapper.findComponent({ name: 'ManagerTabs' }).props('label')).toBe('Settings')
    })

    test('F6 moves focus from the selected component to its selected tab and back, only while editing (#461)', async () => {
      const component = document.createElement('div')
      component.setAttribute('tabindex', '0')
      document.body.append(component)
      const outside = document.createElement('button')
      document.body.append(outside)
      const stackManager = makeStackManager({
        showManager: ref(true),
        currentStackItem: ref({ iri: '/component/1', domElements: ref([component]), managerTabs: [{ name: 'FieldTab', render: () => h('div') }, { name: 'FieldTab', render: () => h('div') }] }),
      })
      cwaState.cwa = makeCwa({ stackManager, isEditing: true })
      const wrapper = await mountManager(document.body)
      resolverState.allMeta.value = [{ name: 'Publish', fields: [] }, { name: 'Content', fields: [] }]
      await nextTick()
      wrapper.findComponent({ name: 'ManagerTabs' }).vm.$emit('click', 1)
      await nextTick()
      const press = (init: KeyboardEventInit = {}) => {
        const event = new KeyboardEvent('keydown', { key: 'F6', bubbles: true, cancelable: true, ...init })
        document.activeElement!.dispatchEvent(event)
        return event
      }

      component.focus()
      expect(press().defaultPrevented).toBe(true)
      expect(document.activeElement?.textContent).toBe('Content')
      expect(press({ shiftKey: true }).defaultPrevented).toBe(true)
      expect(document.activeElement).toBe(component)

      outside.focus()
      press()
      expect(document.activeElement?.textContent).toBe('Content')

      component.focus()
      expect(press({ key: 'F7' }).defaultPrevented).toBe(false)
      expect(press({ ctrlKey: true }).defaultPrevented).toBe(false)
      expect(document.activeElement).toBe(component)

      cwaState.cwa.admin.isEditing = false
      expect(press().defaultPrevented).toBe(false)
      expect(document.activeElement).toBe(component)

      cwaState.cwa.admin.isEditing = true
      wrapper.unmount()
      expect(press().defaultPrevented).toBe(false)
      component.remove()
      outside.remove()
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

  describe('a tab whose root is not CwaUiManagerTab (#461)', () => {
    afterEach(() => {
      vi.unstubAllEnvs()
      vi.restoreAllMocks()
    })

    async function show(tabs: object[], names: string[]) {
      const stackManager = makeStackManager({
        showManager: ref(true),
        currentStackItem: ref({ iri: '/component/1', managerTabs: tabs }),
      })
      cwaState.cwa = makeCwa({ stackManager })
      const wrapper = await mountManager()
      resolverState.allMeta.value = names.map(name => ({ name }))
      await flushPromises()
      return wrapper
    }

    test('warns in development, naming the tab and what to wrap its fields in, once per tab', async () => {
      const warn = vi.spyOn(consola, 'warn').mockImplementation(() => {})
      const TitleTab = { name: 'TitleTab', render: () => h('div', 'Title') }
      const LabelTab = { name: 'LabelTab', render: () => h('div', 'Label') }
      const wrapper = await show([TitleTab, LabelTab], ['Title', 'Label'])

      expect(warn).toHaveBeenCalledOnce()
      expect(warn.mock.calls[0]![0]).toContain('"Title"')
      expect(warn.mock.calls[0]![0]).toContain('CwaUiManagerTab')

      wrapper.findComponent({ name: 'ManagerTabs' }).vm.$emit('click', 1)
      await flushPromises()
      expect(wrapper.text()).toContain('Label')
      expect(warn).toHaveBeenCalledTimes(2)
      expect(warn.mock.calls[1]![0]).toContain('"Label"')

      wrapper.findComponent({ name: 'ManagerTabs' }).vm.$emit('click', 0)
      await flushPromises()
      expect(wrapper.text()).toContain('Title')
      expect(warn).toHaveBeenCalledTimes(2)
    })

    test('says nothing for a tab rendering CwaUiManagerTab at its root', async () => {
      const warn = vi.spyOn(consola, 'warn').mockImplementation(() => {})
      const KitTab = { name: 'KitTab', render: () => h(CwaUiManagerTab, null, () => h('span', 'Title')) }
      const wrapper = await show([KitTab], ['Title'])

      expect(wrapper.find('[data-testid="manager-tab"]').exists()).toBe(true)
      expect(warn).not.toHaveBeenCalled()
    })

    test('looks inside a tab loaded on demand, as the module and apps load their tabs', async () => {
      const warn = vi.spyOn(consola, 'warn').mockImplementation(() => {})
      const KitTab = defineAsyncComponent(async () => ({ name: 'KitTab', render: () => h(CwaUiManagerTab, null, () => h('span', 'Title')) }))
      const PlainTab = defineAsyncComponent(async () => ({ name: 'PlainTab', render: () => h('div', 'Label') }))
      const wrapper = await show([KitTab, PlainTab], ['Title', 'Label'])
      await flushPromises()

      expect(wrapper.find('[data-testid="manager-tab"]').exists()).toBe(true)
      expect(warn).not.toHaveBeenCalled()

      wrapper.findComponent({ name: 'ManagerTabs' }).vm.$emit('click', 1)
      await flushPromises()
      await flushPromises()
      expect(wrapper.text()).toContain('Label')
      expect(warn).toHaveBeenCalledOnce()
      expect(warn.mock.calls[0]![0]).toContain('"Label"')
    })

    test('says nothing for a kit root beside a template-root comment, as a development build renders it (#476 review 5)', async () => {
      const warn = vi.spyOn(consola, 'warn').mockImplementation(() => {})
      const CommentedTab = { name: 'CommentedTab', render: () => [createCommentVNode(' the title tab '), h(CwaUiManagerTab, null, () => h('span', 'Title'))] }
      const wrapper = await show([CommentedTab], ['Title'])

      expect(wrapper.find('[data-testid="manager-tab"]').exists()).toBe(true)
      expect(warn).not.toHaveBeenCalled()
    })

    test('says nothing for a kit root behind a v-if that first renders as a comment (#476 review 5)', async () => {
      const warn = vi.spyOn(consola, 'warn').mockImplementation(() => {})
      const ready = ref(false)
      const LaterTab = { name: 'LaterTab', render: () => ready.value ? h(CwaUiManagerTab, null, () => h('span', 'Title')) : createCommentVNode('v-if', true) }
      const wrapper = await show([LaterTab], ['Title'])
      ready.value = true
      await flushPromises()

      expect(wrapper.find('[data-testid="manager-tab"]').exists()).toBe(true)
      expect(warn).not.toHaveBeenCalled()
    })

    test('says nothing for a tab whose root is a component that renders CwaUiManagerTab (#476 review 5)', async () => {
      const warn = vi.spyOn(consola, 'warn').mockImplementation(() => {})
      const Wrapper = { name: 'AppTabShell', setup: (_: unknown, { slots }: { slots: Record<string, () => unknown> }) => () => h(CwaUiManagerTab, null, slots) }
      const WrappedTab = { name: 'WrappedTab', render: () => h(Wrapper, null, () => h('span', 'Title')) }
      const wrapper = await show([WrappedTab], ['Title'])

      expect(wrapper.find('[data-testid="manager-tab"]').exists()).toBe(true)
      expect(warn).not.toHaveBeenCalled()
    })

    test('says nothing for a tab whose root is a component loaded on demand that renders CwaUiManagerTab (#476 review 5)', async () => {
      const warn = vi.spyOn(consola, 'warn').mockImplementation(() => {})
      const Shell = defineAsyncComponent(async () => ({ name: 'AppAsyncShell', setup: (_: unknown, { slots }: { slots: Record<string, () => unknown> }) => () => h(CwaUiManagerTab, null, slots) }))
      const ShellTab = { name: 'ShellTab', render: () => h(Shell, null, () => h('span', 'Title')) }
      const wrapper = await show([ShellTab], ['Title'])
      await flushPromises()

      expect(wrapper.find('[data-testid="manager-tab"]').exists()).toBe(true)
      expect(warn).not.toHaveBeenCalled()
    })

    test('warns for a tab whose root is a component rendering its fields in a plain element (#476 review 5)', async () => {
      const warn = vi.spyOn(consola, 'warn').mockImplementation(() => {})
      const Shell = { name: 'AppPlainShell', setup: (_: unknown, { slots }: { slots: Record<string, () => unknown> }) => () => h('div', slots.default?.()) }
      const ShellTab = { name: 'ShellTab', render: () => h(Shell, null, () => h('span', 'Title')) }
      await show([ShellTab], ['Title'])

      expect(warn).toHaveBeenCalledOnce()
      expect(warn.mock.calls[0]![0]).toContain('"Title"')
    })

    test('says nothing on switching to the module\'s Group tab from another tab, then warns on switching to a tab without CwaUiManagerTab', async () => {
      const warn = vi.spyOn(consola, 'warn').mockImplementation(() => {})
      const InfoTab = { name: 'InfoTab', render: () => h(CwaUiManagerTab, null, () => h('span', 'Info')) }
      const PlainTab = { name: 'PlainTab', render: () => h('div', 'Label') }
      const wrapper = await show([InfoTab, Group, PlainTab], ['Info', 'Group', 'Label'])
      const tabs = wrapper.findComponent({ name: 'ManagerTabs' })

      tabs.vm.$emit('click', 1)
      await flushPromises()
      expect(wrapper.find('[data-testid="group-add-start"]').exists()).toBe(true)
      expect(warn).not.toHaveBeenCalled()

      tabs.vm.$emit('click', 2)
      await flushPromises()
      expect(wrapper.text()).toContain('Label')
      expect(warn).toHaveBeenCalledOnce()
      expect(warn.mock.calls[0]![0]).toContain('"Label"')
    })

    test('says nothing in production', async () => {
      vi.stubEnv('DEV', false)
      const warn = vi.spyOn(consola, 'warn').mockImplementation(() => {})
      await show([{ name: 'PlainTab', render: () => h('div', 'Title') }], ['Title'])

      expect(warn).not.toHaveBeenCalled()
    })
  })

  describe('drag handles while reordering', () => {
    function reorderingCwa(opts: { reordering: boolean, editing?: boolean, group?: string }) {
      const state = reactive<Record<string, any>>({ reordering: opts.reordering })
      const stackManager = makeStackManager({
        showManager: ref(true),
        currentStackItem: ref({ iri: '/component/1', managerTabs: [] }),
        getState: (prop: string) => state[prop],
        getClosestStackItemByType: vi.fn(() => 'group' in opts ? opts.group : '/_/component_groups/g'),
      })
      cwaState.cwa = makeCwa({ stackManager, isEditing: opts.editing ?? true })
      return state
    }

    test('are loaded for the closest group only once Enable reordering is on', async () => {
      const state = reorderingCwa({ reordering: false })
      const wrapper = await mountManager()
      await flushPromises()
      expect(wrapper.find('.reorder-handles-stub').exists()).toBe(false)
      state.reordering = true
      await flushPromises()
      expect(wrapper.findComponent({ name: 'ReorderHandles' }).props('groupIri')).toBe('/_/component_groups/g')
      state.reordering = false
      await flushPromises()
      expect(wrapper.find('.reorder-handles-stub').exists()).toBe(false)
    })

    test.each([
      ['outside edit mode', { reordering: true, editing: false }],
      ['with no group in the stack', { reordering: true, group: undefined }],
    ])('are not shown %s', async (_label, opts) => {
      reorderingCwa(opts)
      const wrapper = await mountManager()
      await flushPromises()
      expect(wrapper.find('.reorder-handles-stub').exists()).toBe(false)
    })

    test('are not shown while cloning', async () => {
      reorderingCwa({ reordering: true })
      useCloneMode(cwaState.cwa).start('/component/source')
      const wrapper = await mountManager()
      await flushPromises()
      expect(wrapper.find('.reorder-handles-stub').exists()).toBe(false)
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

    async function clickInCloneMode(opts: { stack?: { iri: string }[], target?: Element } = {}) {
      const stackManager = makeStackManager({ isPopulating: ref(true), resourceStack: ref(opts.stack ?? clonedStack) })
      cwaState.cwa = makeCwa({ isEditing: true, stackManager })
      useCloneMode(cwaState.cwa as Cwa).start('/component/source', 'Source')
      const wrapper = await mountManager()
      const preventDefault = vi.fn()
      ;(wrapper.vm as any).clickHandler({ target: opts.target ?? document.createElement('span'), clientX: 310, clientY: 420, detail: 1, preventDefault } as unknown as MouseEvent, 'layout')
      await flushPromises()
      return { wrapper, stackManager, preventDefault }
    }

    function linkWith() {
      const link = document.createElement('a')
      link.setAttribute('href', '/blog/post')
      const inner = document.createElement('span')
      link.append(inner)
      return { link, inner }
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
      expect(menu.props()).toEqual({ stack: clonedStack, type: 'layout', point: { x: 310, y: 420 }, link: undefined })
    })

    test('in clone mode a click on a link opens the placement menu with that link for its Visit row, and the link does not navigate (#157)', async () => {
      const { link, inner } = linkWith()
      const { wrapper, stackManager, preventDefault } = await clickInCloneMode({ target: inner })

      expect(preventDefault).toHaveBeenCalled()
      expect(stackManager.selectStackIndex).not.toHaveBeenCalled()
      expect(wrapper.findComponent({ name: 'LinkMenu' }).exists()).toBe(false)
      expect(wrapper.findComponent({ name: 'ClonePlacementMenu' }).props()).toEqual({ stack: clonedStack, type: 'layout', point: { x: 310, y: 420 }, link })
    })

    test('in clone mode a link outside every component still opens the placement menu, for its Visit row', async () => {
      const { link, inner } = linkWith()
      const { wrapper } = await clickInCloneMode({ stack: [], target: inner })

      expect(wrapper.findComponent({ name: 'ClonePlacementMenu' }).props()).toEqual({ stack: [], type: 'layout', point: { x: 310, y: 420 }, link })
    })

    test('in clone mode a click on nothing opens no menu and selects nothing', async () => {
      const { wrapper, stackManager } = await clickInCloneMode({ stack: [] })

      expect(stackManager.selectStackIndex).not.toHaveBeenCalled()
      expect(wrapper.findComponent({ name: 'ClonePlacementMenu' }).exists()).toBe(false)
    })

    test('a click on another target while the menu is open opens a fresh menu at the new point (#426)', async () => {
      const { wrapper } = await clickInCloneMode()
      const first = wrapper.findComponent({ name: 'ClonePlacementMenu' }).vm

      ;(wrapper.vm as any).clickHandler({ target: document.createElement('span'), clientX: 40, clientY: 50, detail: 1, preventDefault: vi.fn() } as unknown as MouseEvent, 'page')
      await flushPromises()

      const menu = wrapper.findComponent({ name: 'ClonePlacementMenu' })
      expect(menu.vm).not.toBe(first)
      expect(menu.props()).toEqual({ stack: clonedStack, type: 'page', point: { x: 40, y: 50 }, link: undefined })
    })

    test('closing the placement menu removes it', async () => {
      const { wrapper } = await clickInCloneMode()

      wrapper.findComponent({ name: 'ClonePlacementMenu' }).vm.$emit('close')
      await flushPromises()

      expect(wrapper.findComponent({ name: 'ClonePlacementMenu' }).exists()).toBe(false)
    })
  })

  describe('the link menu in edit mode', () => {
    const linkStack = [{ iri: '/component/link', displayName: 'Call to action' }, { iri: '/_/component_positions/p1' }]

    function linkWith() {
      const link = document.createElement('a')
      link.setAttribute('href', '/blog/post')
      const inner = document.createElement('span')
      link.append(inner)
      return { link, inner }
    }

    function withRole(tag: string, role: string) {
      const element = document.createElement(tag)
      element.setAttribute('role', role)
      return element
    }

    async function click(target: Element, opts: { isEditing?: boolean, isModuleSelect?: boolean, stack?: { iri: string }[], event?: Record<string, unknown> } = {}) {
      const stackManager = makeStackManager({ isPopulating: ref(true), resourceStack: ref(opts.stack ?? linkStack), isModuleSelect: !!opts.isModuleSelect })
      cwaState.cwa = makeCwa({ isEditing: opts.isEditing ?? true, stackManager })
      const wrapper = await mountManager()
      const preventDefault = vi.fn()
      ;(wrapper.vm as any).clickHandler({ target, clientX: 120, clientY: 80, detail: 1, preventDefault, ...opts.event } as unknown as MouseEvent, 'layout')
      await flushPromises()
      return { wrapper, stackManager, preventDefault }
    }

    test('a click on a link opens the link menu at the click point instead of selecting, keeping the selection and asking nothing yet, and the link does not navigate (#157)', async () => {
      const { link, inner } = linkWith()
      const { wrapper, stackManager, preventDefault } = await click(inner)

      expect(preventDefault).toHaveBeenCalled()
      expect(stackManager.completeStack).toHaveBeenCalledWith({ clickTarget: inner }, false, 'layout')
      expect(stackManager.selectStackIndex).not.toHaveBeenCalled()
      expect(stackManager.restorePreviousStack).toHaveBeenCalled()
      expect(confirmState.reveal).not.toHaveBeenCalled()
      expect(wrapper.findComponent({ name: 'LinkMenu' }).props()).toEqual({ stack: linkStack, type: 'layout', point: { x: 120, y: 80 }, link })
    })

    test('a link outside every component opens the menu too, for Visit alone', async () => {
      const { link, inner } = linkWith()
      const { wrapper } = await click(inner, { stack: [] })

      expect(wrapper.findComponent({ name: 'LinkMenu' }).props()).toEqual({ stack: [], type: 'layout', point: { x: 120, y: 80 }, link })
    })

    test.each([
      ['a button', () => document.createElement('button')],
      ['a button inside a link', () => linkWith().link.appendChild(document.createElement('button'))],
      ['a tab', () => withRole('div', 'tab')],
      ['an anchor with no href', () => document.createElement('a')],
    ])('%s keeps running its own click and selects as before', async (_name, target) => {
      const { wrapper, stackManager, preventDefault } = await click(target())

      expect(preventDefault).not.toHaveBeenCalled()
      expect(stackManager.selectStackIndex).toHaveBeenCalledWith(0, false)
      expect(wrapper.findComponent({ name: 'LinkMenu' }).exists()).toBe(false)
    })

    test('outside edit mode a link is left to navigate', async () => {
      const { inner } = linkWith()
      const { wrapper, preventDefault } = await click(inner, { isEditing: false })

      expect(preventDefault).not.toHaveBeenCalled()
      expect(wrapper.findComponent({ name: 'LinkMenu' }).exists()).toBe(false)
    })

    test('a click the module dispatches to select a component, as after adding one, selects even when the component is a link', async () => {
      const { link } = linkWith()
      const { wrapper, stackManager } = await click(link, { isModuleSelect: true })

      expect(stackManager.selectStackIndex).toHaveBeenCalledWith(0, false)
      expect(wrapper.findComponent({ name: 'LinkMenu' }).exists()).toBe(false)
    })

    test('Enter on a focused link, a click with no pointer, opens the menu at the link\'s lower left corner even when no component is under it', async () => {
      const { link } = linkWith()
      link.getBoundingClientRect = () => ({ left: 30, bottom: 64, top: 40, right: 90, width: 60, height: 24 }) as DOMRect
      const stackManager = makeStackManager({ isPopulating: ref(false), resourceStack: ref([]) })
      cwaState.cwa = makeCwa({ isEditing: true, stackManager })
      const wrapper = await mountManager()
      ;(wrapper.vm as any).clickHandler({ target: link, clientX: 0, clientY: 0, detail: 0, preventDefault: vi.fn() } as unknown as MouseEvent, 'page')
      await flushPromises()

      expect(wrapper.findComponent({ name: 'LinkMenu' }).props('point')).toEqual({ x: 30, y: 64 })
    })

    test('a second link click opens a fresh menu, and closing it removes it', async () => {
      const { inner } = linkWith()
      const { wrapper } = await click(inner)
      const first = wrapper.findComponent({ name: 'LinkMenu' }).vm

      ;(wrapper.vm as any).clickHandler({ target: inner, clientX: 5, clientY: 6, detail: 1, preventDefault: vi.fn() } as unknown as MouseEvent, 'page')
      await flushPromises()
      const menu = wrapper.findComponent({ name: 'LinkMenu' })
      expect(menu.vm).not.toBe(first)
      expect(menu.props('point')).toEqual({ x: 5, y: 6 })

      menu.vm.$emit('close')
      await flushPromises()
      expect(wrapper.findComponent({ name: 'LinkMenu' }).exists()).toBe(false)
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
      expect(wrapper.findComponent({ name: 'CwaAdminResourceManagerContextMenu' }).props('point')).toEqual({ x: 20, y: 30, key: expect.any(Number) })
    })

    test('a right-click elsewhere while open reopens the menu at the new point, as a new menu (#461)', async () => {
      const stackManager = makeStackManager({ isContextPopulating: ref(true) })
      cwaState.cwa = makeCwa({ isEditing: true, hasRole: true, stackManager })
      const wrapper = await mountManager()
      const menu = () => wrapper.findComponent({ name: 'CwaAdminResourceManagerContextMenu' })

      ;(wrapper.vm as any).contextMenuHandler({ clientX: 20, clientY: 30, preventDefault: vi.fn(), target: document.createElement('div') }, 'page')
      await nextTick()
      const first = menu().props('point')
      ;(wrapper.vm as any).contextMenuHandler({ clientX: 200, clientY: 300, preventDefault: vi.fn(), target: document.createElement('div') }, 'page')
      await nextTick()

      expect(menu().props('modelValue')).toBe(true)
      expect(menu().props('point')).toEqual({ x: 200, y: 300, key: expect.any(Number) })
      expect(menu().props('point').key).not.toBe(first.key)
    })

    test.each(['page', 'layout'] as const)('a right-click on empty %s space, with no component, position or group under it, leaves the browser\'s menu and opens nothing (#461)', async (type) => {
      const contextStack = ref<{ iri: string }[]>([])
      const stackManager = makeStackManager({ isContextPopulating: ref(true), contextStack })
      stackManager.completeStack.mockImplementation(() => {
        contextStack.value = contextStack.value.length ? [{ iri: type === 'page' ? '/_/pages/home' : '/_/layouts/main' }] : [{ iri: '/component/1' }]
      })
      cwaState.cwa = makeCwa({ isEditing: true, hasRole: true, stackManager })
      const wrapper = await mountManager()
      const menu = () => wrapper.findComponent({ name: 'CwaAdminResourceManagerContextMenu' })
      ;(wrapper.vm as any).contextMenuHandler({ clientX: 20, clientY: 30, preventDefault: vi.fn(), target: document.createElement('div') }, type)
      await nextTick()
      expect(menu().props('modelValue')).toBe(true)

      const preventDefault = vi.fn()
      ;(wrapper.vm as any).contextMenuHandler({ clientX: 400, clientY: 300, preventDefault, target: document.createElement('div') }, type)
      await nextTick()

      expect(stackManager.completeStack).toHaveBeenLastCalledWith({ clickTarget: expect.any(HTMLElement) }, true, type)
      expect(preventDefault).not.toHaveBeenCalled()
      expect(menu().props('modelValue')).toBe(false)
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
    test('a right-click never selects or opens the CWA menu, and leaves the browser menu', async () => {
      const stackManager = makeStackManager({ isContextPopulating: ref(true) })
      cwaState.cwa = makeCwa({ isEditing: true, hasRole: true, stackManager })
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
  describe('long press (#461)', () => {
    test('a long touch press on the page is a right-click while the manager is mounted, and not after', async () => {
      cwaState.cwa = makeCwa({ hasRole: true, isEditing: true })
      const wrapper = await mountManager()
      const target = document.createElement('p')
      document.body.append(target)
      const contextMenus = vi.fn()
      target.addEventListener('contextmenu', contextMenus)
      vi.useFakeTimers()
      try {
        const press = () => {
          const down = new MouseEvent('pointerdown', { clientX: 30, clientY: 40, bubbles: true })
          Object.defineProperties(down, { pointerType: { value: 'touch' }, pointerId: { value: 1 } })
          target.dispatchEvent(down)
          vi.advanceTimersByTime(500)
          target.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }))
          vi.advanceTimersByTime(1000)
        }
        press()
        expect(contextMenus).toHaveBeenCalledTimes(1)
        expect(contextMenus.mock.calls[0]![0]).toMatchObject({ clientX: 30, clientY: 40 })

        wrapper.unmount()
        press()
        expect(contextMenus).toHaveBeenCalledTimes(1)
      }
      finally {
        vi.useRealTimers()
        target.remove()
      }
    })

    test('a long press is a right-click only while editing, so outside edit mode the browser keeps its own touch menu', async () => {
      const cwa = makeCwa({ hasRole: true })
      const editing = ref(false)
      Object.defineProperty(cwa.admin, 'isEditing', { get: () => editing.value })
      cwaState.cwa = cwa
      const wrapper = await mountManager()
      const target = document.createElement('p')
      document.body.append(target)
      const contextMenus = vi.fn()
      target.addEventListener('contextmenu', contextMenus)
      vi.useFakeTimers()
      try {
        const press = () => {
          const down = new MouseEvent('pointerdown', { clientX: 30, clientY: 40, bubbles: true })
          Object.defineProperties(down, { pointerType: { value: 'touch' }, pointerId: { value: 1 } })
          target.dispatchEvent(down)
          vi.advanceTimersByTime(500)
          target.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }))
          vi.advanceTimersByTime(1000)
        }
        press()
        expect(contextMenus).not.toHaveBeenCalled()

        editing.value = true
        await nextTick()
        press()
        expect(contextMenus).toHaveBeenCalledTimes(1)

        editing.value = false
        await nextTick()
        press()
        expect(contextMenus).toHaveBeenCalledTimes(1)
        wrapper.unmount()
      }
      finally {
        vi.useRealTimers()
        target.remove()
      }
    })
  })
})
