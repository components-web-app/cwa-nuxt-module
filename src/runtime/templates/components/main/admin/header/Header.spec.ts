// @vitest-environment happy-dom
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, reactive, computed } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import Header from './Header.vue'
import { useCloneMode } from '#cwa/admin/clone-mode'
import type Cwa from '#cwa/cwa'
import * as cwaComposable from '#cwa/composables/cwa'

const strandedState = reactive({
  stranded: [] as any[],
  shown: [] as any[],
})

vi.mock('#cwa/admin/stranded-component-groups', () => ({
  useStrandedComponentGroups: () => ({
    stranded: computed(() => strandedState.stranded),
    shown: computed(() => strandedState.shown),
  }),
}))

const extensionState = vi.hoisted(() => ({ areas: [] as any[], topBarDefault: undefined as string[] | undefined }))

vi.mock('#build/cwa-extension-areas', () => ({
  get extensionAreas() { return extensionState.areas },
}))

vi.mock('#build/cwa-admin-top-bar', () => ({
  get topBarDefault() { return extensionState.topBarDefault },
}))

vi.mock('#cwa/templates/components/core/admin/StrandedComponentGroupsModal.vue', () => ({
  default: {
    name: 'StrandedComponentGroupsModal',
    props: ['groups', 'targets'],
    emits: ['close'],
    template: '<div class="stranded-modal-stub" data-testid="stranded-groups-modal" />',
  },
}))

const errorRef = ref<any>(null)
const replaceMock = vi.fn()

const mockRouteMeta = reactive<{ cwa?: { admin?: boolean } }>({ cwa: { admin: false } })

mockNuxtImport('useError', () => () => errorRef)
const mockRoute = reactive({ meta: mockRouteMeta, fullPath: '/' })

mockNuxtImport('useRoute', () => () => mockRoute)
mockNuxtImport('useRouter', () => () => ({ replace: replaceMock }))

function buildResources(overrides: Record<string, any> = {}) {
  return reactive({
    page: { value: { data: { reference: 'My Reference' } } },
    pageData: { value: { data: { 'title': 'My Data Title', '@type': 'BlogData', 'route': null } } },
    isDataPage: { value: false },
    isDynamicPage: { value: false },
    isLoading: { value: false },
    newResource: { value: null },
    displayPageIri: { value: '/_/pages/uuid-self' },
    ...overrides,
  })
}

function buildAdmin(overrides: Record<string, any> = {}) {
  return reactive({
    isEditing: false,
    toggleEdit: vi.fn(),
    resourceStackManager: { showManager: { value: false } },
    ...overrides,
  })
}

function mockCwa({
  resources,
  admin,
  requestCount = 0,
  roles = ['ROLE_SUPER_ADMIN', 'ROLE_ADMIN', 'ROLE_USER_ADMIN', 'ROLE_CMS_ADMIN', 'ROLE_USER'],
  user = { '@id': '/_/users/admin' },
}: {
  resources?: any
  admin?: any
  requestCount?: number
  roles?: string[]
  user?: Record<string, any>
} = {}) {
  const res = resources ?? buildResources()
  const adm = admin ?? buildAdmin()
  const cwa = {
    resources: res,
    admin: adm,
    auth: { user: reactive(user), isAdmin: computed(() => roles.includes('ROLE_CMS_ADMIN')), hasRole: (role: string) => roles.includes(role) },
    resourcesManager: { requestCount: { value: requestCount }, confirmDiscardAddingResource: vi.fn(async () => true) },
  } as unknown as Cwa
  vi.spyOn(cwaComposable, 'useCwa').mockImplementation(() => cwa)
  mockedCwas.push(cwa)
  return { res, adm, cwa }
}

const mockedCwas: Cwa[] = []

function mountHeader(options: { stubs?: Record<string, any>, attachTo?: HTMLElement } = {}) {
  return mount(Header, {
    attachTo: options.attachTo,
    global: {
      stubs: {
        PathSelector: { name: 'PathSelector', template: '<div class="path-selector-stub" />' },
        RequestErrors: { name: 'RequestErrors', template: '<div class="request-errors-stub" />' },
        FailedSaveToasts: { name: 'FailedSaveToasts', template: '<div class="failed-save-toasts-stub" />' },
        Menu: { name: 'Menu', template: '<div class="menu-stub" />' },
        SpinnerTick: { name: 'SpinnerTick', props: ['isLoading', 'isPending'], template: '<div class="spinner-tick-stub" />' },
        OutdatedContentNotice: { name: 'OutdatedContentNotice', template: '<div class="outdated-stub" />' },
        CloneHighlight: { name: 'CloneHighlight', template: '<div class="clone-highlight-stub" />' },
        PresenceIndicator: { name: 'PresenceIndicator', template: '<div class="presence-indicator-stub" />' },
        ResourceLoadingIndicator: { name: 'ResourceLoadingIndicator', template: '<div class="loading-indicator-stub" />' },
        ResourceModalOverlayTemplate: {
          name: 'ResourceModalOverlayTemplate',
          props: ['show'],
          template: '<div class="overlay-stub" :data-show="show"><slot /></div>',
        },
        PageResourceAdminModal: {
          name: 'PageResourceAdminModal',
          props: ['iri', 'resourceType', 'hideViewLink'],
          emits: ['close', 'reload'],
          template: '<div class="page-admin-modal-stub" />',
        },
        CwaUiButton: {
          name: 'CwaUiButton',
          props: ['label', 'variant', 'tone', 'size', 'icon', 'iconOnly', 'loading', 'ariaLabel'],
          emits: ['click'],
          template: '<button type="button" :aria-label="ariaLabel" @click="$emit(\'click\', $event)">{{ label }}<slot /></button>',
        },
        CwaUiToggle: {
          name: 'CwaUiToggle',
          props: ['modelValue', 'label'],
          template: '<div class="toggle-stub" />',
        },
        CwaUiIconCogIcon: { name: 'CwaUiIconCogIcon', template: '<svg class="cog-icon-stub" />' },
        CwaUiIconWarningIcon: { name: 'CwaUiIconWarningIcon', template: '<svg class="warning-icon-stub" />' },
        NuxtLink: { name: 'NuxtLink', props: ['to', 'activeClass'], template: '<a :href="typeof to === \'string\' ? to : JSON.stringify(to)"><slot /></a>' },
        IconLayouts: { name: 'IconLayouts', template: '<svg class="icon-layouts" />' },
        IconPages: { name: 'IconPages', template: '<svg class="icon-pages" />' },
        IconData: { name: 'IconData', template: '<svg class="icon-data" />' },
        IconRoutes: { name: 'IconRoutes', template: '<svg class="icon-routes" />' },
        IconUsers: { name: 'IconUsers', template: '<svg class="icon-users" />' },
        ...options.stubs,
      },
    },
  })
}

describe('Header', () => {
  afterEach(() => {
    mockedCwas.forEach(cwa => useCloneMode(cwa).end())
    mockedCwas.length = 0
  })

  beforeEach(() => {
    vi.clearAllMocks()
    errorRef.value = null
    mockRouteMeta.cwa = { admin: false }
    mockRoute.fullPath = '/'
    extensionState.areas = []
    extensionState.topBarDefault = undefined
    strandedState.stranded = []
    strandedState.shown = []
  })

  describe('stranded component groups warning', () => {
    const strandedGroup = { iri: '/_/component_groups/top', reference: 'top', positions: [] }
    const otherStrandedGroup = { iri: '/_/component_groups/footer', reference: 'footer', positions: [] }
    const shownGroup = { iri: '/_/component_groups/hero', reference: 'hero' }

    test('shows no warning when no attached group is stranded', () => {
      mockCwa()
      const wrapper = mountHeader()
      expect(wrapper.find('[data-testid="stranded-groups-warning"]').exists()).toBe(false)
    })

    test('shows the warning with the count of stranded groups next to the Edit button', () => {
      strandedState.stranded = [strandedGroup, otherStrandedGroup]
      mockCwa()
      const wrapper = mountHeader()
      const warning = wrapper.find('[data-testid="stranded-groups-warning"]')
      expect(warning.exists()).toBe(true)
      expect(warning.text()).toContain('2')
      expect(warning.attributes('aria-label')).toBe('2 component groups attached to this page are not shown on it')
      expect(warning.element.parentElement!.textContent).toContain('Edit')
    })

    test('shows no warning on an admin page', () => {
      strandedState.stranded = [strandedGroup]
      mockRouteMeta.cwa = { admin: true }
      mockCwa()
      const wrapper = mountHeader()
      expect(wrapper.find('[data-testid="stranded-groups-warning"]').exists()).toBe(false)
    })

    test('opens the modal with every stranded group and the shown groups as targets, and closes it', async () => {
      strandedState.stranded = [strandedGroup, otherStrandedGroup]
      strandedState.shown = [shownGroup]
      mockCwa()
      const wrapper = mountHeader()
      expect(wrapper.findComponent({ name: 'StrandedComponentGroupsModal' }).exists()).toBe(false)
      await wrapper.find('[data-testid="stranded-groups-warning"]').trigger('click')
      await flushPromises()
      const modal = wrapper.findComponent({ name: 'StrandedComponentGroupsModal' })
      expect(modal.props('groups')).toEqual([strandedGroup, otherStrandedGroup])
      expect(modal.props('targets')).toEqual([shownGroup])
      modal.vm.$emit('close')
      await flushPromises()
      expect(wrapper.findComponent({ name: 'StrandedComponentGroupsModal' }).exists()).toBe(false)
    })
  })

  describe('mount + spacer side effect (onMounted)', () => {
    test('renders the header element and sets the spacer height to the header height', () => {
      mockCwa()
      const wrapper = mountHeader()
      const headerEl = wrapper.find('[ref="header"]').exists()
        ? wrapper.find('[ref="header"]')
        : null
      const refs = wrapper.vm.$refs as Record<string, HTMLElement>
      expect(refs.header).toBeTruthy()
      expect(refs.spacer).toBeTruthy()
      Object.defineProperty(refs.header, 'clientHeight', { value: 72, configurable: true })
      expect(refs.spacer.style.height).toMatch(/px$/)
      void headerEl
    })
  })

  describe('Edit / Done button', () => {
    test('Edit and Done are the kit\'s solid accent button, busy while the page loads', () => {
      mockCwa({ admin: buildAdmin({ isEditing: false }) })
      const wrapper = mountHeader()
      const editBtn = wrapper.findAllComponents({ name: 'CwaUiButton' }).find(b => b.props('label') === 'Edit')!
      expect(editBtn.props('variant')).toBe('solid')
    })

    test('shows "Edit" when not editing and calls toggleEdit on click', async () => {
      const { adm } = mockCwa({ admin: buildAdmin({ isEditing: false }) })
      const wrapper = mountHeader()
      const editBtn = wrapper.findAllComponents({ name: 'CwaUiButton' })
        .find(b => b.text().trim() === 'Edit')
      expect(editBtn).toBeTruthy()
      await editBtn!.trigger('click')
      expect(adm.toggleEdit).toHaveBeenCalled()
    })

    test.each([
      [false, 'Keep editing stays in edit mode with the new component still selected'],
      [true, 'Discard leaves edit mode'],
    ])('Done with a new component not yet added asks to discard it first: %s, %s', async (discard) => {
      const { adm, cwa } = mockCwa({ admin: buildAdmin({ isEditing: true }) })
      const confirm = vi.mocked(cwa.resourcesManager.confirmDiscardAddingResource)
      let answer!: (value: boolean) => void
      confirm.mockReturnValueOnce(new Promise((resolve) => {
        answer = resolve
      }))
      const wrapper = mountHeader()
      await wrapper.findAll('button').find(button => button.text().trim() === 'Done')!.trigger('click')
      expect(confirm).toHaveBeenCalledTimes(1)
      expect(adm.toggleEdit).not.toHaveBeenCalled()
      answer(discard)
      await flushPromises()
      if (discard) {
        expect(adm.toggleEdit).toHaveBeenCalledWith(false)
      }
      else {
        expect(adm.toggleEdit).not.toHaveBeenCalled()
      }
    })

    test('Edit never asks about a new component', async () => {
      const { adm, cwa } = mockCwa({ admin: buildAdmin({ isEditing: false }) })
      const wrapper = mountHeader()
      await wrapper.findAll('button').find(button => button.text().trim() === 'Edit')!.trigger('click')
      expect(cwa.resourcesManager.confirmDiscardAddingResource).not.toHaveBeenCalled()
      expect(adm.toggleEdit).toHaveBeenCalledWith(true)
    })

    test('shows "Done" when editing', () => {
      mockCwa({ admin: buildAdmin({ isEditing: true }) })
      const wrapper = mountHeader()
      const labels = wrapper.findAllComponents({ name: 'CwaUiButton' }).map(b => b.text().trim())
      expect(labels).toContain('Done')
      expect(labels).not.toContain('Edit')
    })

    test('Edit button is not rendered on an admin page', () => {
      mockRouteMeta.cwa = { admin: true }
      mockCwa()
      const wrapper = mountHeader()
      const labels = wrapper.findAllComponents({ name: 'CwaUiButton' }).map(b => b.text().trim())
      expect(labels).not.toContain('Edit')
      expect(labels).not.toContain('Done')
    })

    test('Edit button is not rendered on an error page', () => {
      errorRef.value = { statusCode: 500 }
      mockCwa()
      const wrapper = mountHeader()
      const labels = wrapper.findAllComponents({ name: 'CwaUiButton' }).map(b => b.text().trim())
      expect(labels).not.toContain('Edit')
    })
  })

  describe('focus order follows what is seen', () => {
    test('Edit, then the page settings, then the menu, as they sit left to right', () => {
      mockCwa({
        admin: buildAdmin({ isEditing: false }),
        resources: buildResources({ page: { value: { data: { reference: 'About Us' } } } }),
      })
      const wrapper = mountHeader()
      const edit = wrapper.findAll('button').find(button => button.text().trim() === 'Edit')!.element
      const settings = wrapper.get('[data-testid="page-settings"]').element
      const menu = wrapper.get('.menu-stub').element
      expect(edit.compareDocumentPosition(settings) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      expect(settings.compareDocumentPosition(menu) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })

    test('while editing, Done comes before the path selector', () => {
      mockCwa({ admin: buildAdmin({ isEditing: true, resourceStackManager: { showManager: { value: true } } }) })
      const wrapper = mountHeader()
      const done = wrapper.findAll('button').find(button => button.text().trim() === 'Done')!.element
      const selector = wrapper.get('.path-selector-stub').element
      expect(done.compareDocumentPosition(selector) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })
  })

  describe('edit page label / button', () => {
    test('shows the page reference as the edit-page button label when not editing', () => {
      mockCwa({
        admin: buildAdmin({ isEditing: false }),
        resources: buildResources({ page: { value: { data: { reference: 'About Us' } } } }),
      })
      const wrapper = mountHeader()
      expect(wrapper.text()).toContain('About Us')
    })

    test('uses the page data title when on a data page', () => {
      mockCwa({
        admin: buildAdmin({ isEditing: false }),
        resources: buildResources({
          isDataPage: { value: true },
          pageData: { value: { data: { 'title': 'Latest News', '@type': 'NewsData' } } },
        }),
      })
      const wrapper = mountHeader()
      expect(wrapper.text()).toContain('Latest News')
    })

    test('falls back to "Data Page" when on a data page with no title', () => {
      mockCwa({
        admin: buildAdmin({ isEditing: false }),
        resources: buildResources({
          isDataPage: { value: true },
          pageData: { value: { data: { 'title': '', '@type': 'NewsData' } } },
        }),
      })
      const wrapper = mountHeader()
      expect(wrapper.text()).toContain('Data Page')
    })

    test('clicking the edit-page label opens the page admin modal', async () => {
      mockCwa({ admin: buildAdmin({ isEditing: false }) })
      const wrapper = mountHeader()
      expect(wrapper.findComponent({ name: 'PageResourceAdminModal' }).exists()).toBe(false)
      const button = wrapper.findAllComponents({ name: 'CwaUiButton' }).find(b => b.props('label') === 'My Reference')
      expect(button).toBeTruthy()
      expect(button!.props('ariaLabel')).toBe('Page settings: My Reference')
      await button!.trigger('click')
      expect(wrapper.findComponent({ name: 'PageResourceAdminModal' }).exists()).toBe(true)
    })

    test('the edit-page button is hidden while editing', () => {
      mockCwa({ admin: buildAdmin({ isEditing: true }) })
      const wrapper = mountHeader()
      expect(wrapper.text()).not.toContain('My Reference')
    })
  })

  describe('PathSelector', () => {
    test('renders PathSelector while editing when the resource stack manager is showing', () => {
      mockCwa({
        admin: buildAdmin({ isEditing: true, resourceStackManager: { showManager: { value: true } } }),
      })
      const wrapper = mountHeader()
      expect(wrapper.findComponent({ name: 'PathSelector' }).exists()).toBe(true)
    })

    test('does not render PathSelector when the manager is hidden', () => {
      mockCwa({
        admin: buildAdmin({ isEditing: true, resourceStackManager: { showManager: { value: false } } }),
      })
      const wrapper = mountHeader()
      expect(wrapper.findComponent({ name: 'PathSelector' }).exists()).toBe(false)
    })
  })

  describe('admin nav links', () => {
    test('renders the admin navigation links when on an admin page', () => {
      mockRouteMeta.cwa = { admin: true }
      mockCwa()
      const wrapper = mountHeader()
      const hrefs = wrapper.findAll('a').map(a => a.attributes('href'))
      expect(hrefs).toEqual(
        expect.arrayContaining(['/_cwa/layouts', '/_cwa/pages', '/_cwa/data', '/_cwa/routes', '/_cwa/users']),
      )
    })

    test('does not render admin nav links on a normal page', () => {
      mockCwa()
      const wrapper = mountHeader()
      const hrefs = wrapper.findAll('a').map(a => a.attributes('href'))
      expect(hrefs).not.toContain('/_cwa/layouts')
    })
  })

  describe('the admin top bar', () => {
    const centreLinks = (wrapper: ReturnType<typeof mountHeader>) => wrapper.findAll('[data-testid="header-centre"] a').map(link => [link.attributes('href'), link.find('.cwa\\:sr-only').text()])
    const shop = { segment: 'shop', label: 'Shop', icon: '<svg id="shop-icon" />', topBar: true, pages: [{ path: '', label: 'Orders', role: 'ROLE_ADMIN' }] }

    test('starts with a house linking back to the site page the admin was on before opening the admin area', async () => {
      mockCwa()
      mockRoute.fullPath = '/blog/first?tag=news'
      const wrapper = mountHeader()
      mockRouteMeta.cwa = { admin: true }
      mockRoute.fullPath = '/_cwa/pages'
      await flushPromises()
      const home = wrapper.get('[data-testid="header-centre"] a')
      expect(home.attributes('href')).toBe('/blog/first?tag=news')
      expect(home.text()).toBe('Back to the site')
      expect(home.find('[data-testid="top-bar-home-icon"]').exists()).toBe(true)
    })

    test('remembers the site page when the header is mounted again in the admin area, and never an error page', async () => {
      mockCwa()
      mockRoute.fullPath = '/about'
      mountHeader().unmount()
      errorRef.value = { statusCode: 404 }
      mockRoute.fullPath = '/missing'
      mountHeader().unmount()
      errorRef.value = null
      mockRouteMeta.cwa = { admin: true }
      mockRoute.fullPath = '/_cwa/pages'
      expect(mountHeader().get('[data-testid="header-centre"] a').attributes('href')).toBe('/about')
    })

    test('goes to the home page when no site page has been seen', () => {
      mockRouteMeta.cwa = { admin: true }
      mockCwa()
      expect(centreLinks(mountHeader())[0]).toEqual(['/', 'Back to the site'])
    })

    test('after the house come the default items, with an extension that asks for the top bar and its icon', () => {
      mockRouteMeta.cwa = { admin: true }
      extensionState.areas = [shop]
      mockCwa()
      const wrapper = mountHeader()
      expect(centreLinks(wrapper)).toEqual([
        ['/', 'Back to the site'],
        ['/_cwa/layouts', 'Layouts'],
        ['/_cwa/pages', 'Pages'],
        ['/_cwa/data', 'Data'],
        ['/_cwa/routes', 'Routes'],
        ['/_cwa/users', 'Users'],
        ['{"name":"_cwa-shop"}', 'Shop'],
      ])
      expect(wrapper.find('[data-testid="header-centre"] #shop-icon').exists()).toBe(true)
    })

    test('follows the developer\'s default when the admin has chosen nothing, keeping the house first', () => {
      mockRouteMeta.cwa = { admin: true }
      extensionState.areas = [shop]
      extensionState.topBarDefault = ['routes', 'ext:shop']
      mockCwa()
      expect(centreLinks(mountHeader())).toEqual([
        ['/', 'Back to the site'],
        ['/_cwa/routes', 'Routes'],
        ['{"name":"_cwa-shop"}', 'Shop'],
      ])
    })

    test('follows the admin\'s own list over the developer\'s, and changes as soon as it is saved', async () => {
      mockRouteMeta.cwa = { admin: true }
      extensionState.areas = [shop]
      extensionState.topBarDefault = ['routes']
      const { cwa } = mockCwa({ user: { '@id': '/_/users/admin', 'adminPreferences': { topBar: ['ext:shop', 'pages'] } } })
      const wrapper = mountHeader()
      expect(centreLinks(wrapper)).toEqual([
        ['/', 'Back to the site'],
        ['{"name":"_cwa-shop"}', 'Shop'],
        ['/_cwa/pages', 'Pages'],
      ])
      cwa.auth.user!.adminPreferences = { topBar: ['data'] }
      await flushPromises()
      expect(centreLinks(wrapper)).toEqual([
        ['/', 'Back to the site'],
        ['/_cwa/data', 'Data'],
      ])
    })
  })

  describe('editing controls (SpinnerTick vs Menu)', () => {
    test('shows the SpinnerTick (not the Menu) while editing', () => {
      mockCwa({ admin: buildAdmin({ isEditing: true }) })
      const wrapper = mountHeader()
      expect(wrapper.findComponent({ name: 'SpinnerTick' }).exists()).toBe(true)
      expect(wrapper.findComponent({ name: 'Menu' }).exists()).toBe(false)
    })

    test('shows the Menu (not the SpinnerTick) when not editing', () => {
      mockCwa({ admin: buildAdmin({ isEditing: false }) })
      const wrapper = mountHeader()
      expect(wrapper.findComponent({ name: 'Menu' }).exists()).toBe(true)
      expect(wrapper.findComponent({ name: 'SpinnerTick' }).exists()).toBe(false)
    })

    test('SpinnerTick is-loading reflects resourcesManager.requestCount > 0', () => {
      mockCwa({ admin: buildAdmin({ isEditing: true }), requestCount: 3 })
      const wrapper = mountHeader()
      expect(wrapper.findComponent({ name: 'SpinnerTick' }).props('isLoading')).toBe(true)
    })

    test('SpinnerTick is-loading is false when requestCount is 0', () => {
      mockCwa({ admin: buildAdmin({ isEditing: true }), requestCount: 0 })
      const wrapper = mountHeader()
      expect(wrapper.findComponent({ name: 'SpinnerTick' }).props('isLoading')).toBe(false)
    })

    test('SpinnerTick is-pending reflects a pending newResource', () => {
      mockCwa({
        admin: buildAdmin({ isEditing: true }),
        resources: buildResources({ newResource: { value: { '@id': '/component/new' } } }),
      })
      const wrapper = mountHeader()
      expect(wrapper.findComponent({ name: 'SpinnerTick' }).props('isPending')).toBe(true)
    })
  })

  describe('highlightClass', () => {
    function classOf(wrapper: ReturnType<typeof mountHeader>) {
      const refs = wrapper.vm.$refs as Record<string, HTMLElement>
      return refs.header.className
    }

    test('is a 3px strip, as tall as Nuxt\'s loading indicator', () => {
      mockCwa()
      const wrapper = mountHeader()
      expect(classOf(wrapper)).toContain('cwa:before:h-[3px]')
      expect(classOf(wrapper)).not.toContain('cwa:before:h-0.5')
    })

    test('uses the yellow accent for a dynamic page', () => {
      mockCwa({ resources: buildResources({ isDynamicPage: { value: true } }) })
      const wrapper = mountHeader()
      expect(classOf(wrapper)).toContain('cwa:before:bg-type-dynamic')
    })

    test('uses green for a data page that has a route', () => {
      mockCwa({
        resources: buildResources({
          isDataPage: { value: true },
          pageData: { value: { data: { title: 'x', route: '/_/routes/uuid' } } },
        }),
      })
      const wrapper = mountHeader()
      expect(classOf(wrapper)).toContain('cwa:before:bg-success')
    })

    test('uses orange for a data page with no route', () => {
      mockCwa({
        resources: buildResources({
          isDataPage: { value: true },
          pageData: { value: { data: { title: 'x', route: null } } },
        }),
      })
      const wrapper = mountHeader()
      expect(classOf(wrapper)).toContain('cwa:before:bg-warning')
    })

    test('uses the stone accent on an admin page', () => {
      mockRouteMeta.cwa = { admin: true }
      mockCwa()
      const wrapper = mountHeader()
      expect(classOf(wrapper)).toContain('cwa:before:bg-stone-400')
    })

    test('uses the blue accent on a normal page', () => {
      mockCwa()
      const wrapper = mountHeader()
      expect(classOf(wrapper)).toContain('cwa:before:bg-type-static')
    })
  })

  describe('editPageResourceType passed to the modal', () => {
    test('is "Page" for a normal page', async () => {
      mockCwa({ admin: buildAdmin({ isEditing: false }) })
      const wrapper = mountHeader()
      await wrapper.get('[data-testid="page-settings"]').trigger('click')
      expect(wrapper.findComponent({ name: 'PageResourceAdminModal' }).props('resourceType')).toBe('Page')
    })

    test('is the page-data @type for a data page', async () => {
      mockCwa({
        admin: buildAdmin({ isEditing: false }),
        resources: buildResources({
          isDataPage: { value: true },
          pageData: { value: { data: { 'title': 'News', '@type': 'NewsData', 'route': null } } },
        }),
      })
      const wrapper = mountHeader()
      await wrapper.get('[data-testid="page-settings"]').trigger('click')
      expect(wrapper.findComponent({ name: 'PageResourceAdminModal' }).props('resourceType')).toBe('NewsData')
    })
  })

  describe('modal close / reload handlers', () => {
    test('@close closes the page settings dialog', async () => {
      mockCwa({ admin: buildAdmin({ isEditing: false }) })
      const wrapper = mountHeader()
      await wrapper.get('[data-testid="page-settings"]').trigger('click')
      expect(wrapper.findComponent({ name: 'PageResourceAdminModal' }).exists()).toBe(true)
      await wrapper.findComponent({ name: 'PageResourceAdminModal' }).vm.$emit('close')
      expect(wrapper.findComponent({ name: 'PageResourceAdminModal' }).exists()).toBe(false)
    })

    test('@reload navigates to the admin pages view', async () => {
      mockCwa({ admin: buildAdmin({ isEditing: false }) })
      const wrapper = mountHeader()
      await wrapper.get('[data-testid="page-settings"]').trigger('click')
      await wrapper.findComponent({ name: 'PageResourceAdminModal' }).vm.$emit('reload')
      expect(replaceMock).toHaveBeenCalledWith('/_cwa/pages')
    })

    test('@reload does not navigate once the modal has already taken us to an admin page', async () => {
      mockCwa({ admin: buildAdmin({ isEditing: false }) })
      const wrapper = mountHeader()
      await wrapper.get('[data-testid="page-settings"]').trigger('click')
      mockRouteMeta.cwa = { admin: true }
      await wrapper.findComponent({ name: 'PageResourceAdminModal' }).vm.$emit('reload')
      expect(replaceMock).not.toHaveBeenCalled()
    })
  })

  describe('clone mode', () => {
    const SOURCE_IRI = '/component/html_contents/source-uuid'

    test('shows the Cloning bar with the source name and Cancel while cloning', async () => {
      const { cwa } = mockCwa({ admin: buildAdmin({ isEditing: true }) })
      const wrapper = mountHeader()
      expect(wrapper.find('[data-testid="clone-mode-bar"]').exists()).toBe(false)
      useCloneMode(cwa).start(SOURCE_IRI, 'Hero text')
      await flushPromises()
      const bar = wrapper.find('[data-testid="clone-mode-bar"]')
      expect(bar.exists()).toBe(true)
      expect(bar.text()).toContain('Cloning: Hero text')
      expect(bar.find('button').text()).toBe('Cancel')
    })

    test.each([
      ['a clone', undefined, 'Cloning: Body Text — “Shared source component”'],
      ['a move', { positionIri: '/_/component_positions/p1', fromLayout: false, from: { componentPosition: '/_/component_positions/p1' } }, 'Moving: Body Text — “Shared source component”'],
    ] as const)('in %s the bar names the content as well as its type', async (_label, move, expected) => {
      const { cwa } = mockCwa({ admin: buildAdmin({ isEditing: true }) })
      useCloneMode(cwa).start(SOURCE_IRI, 'Body Text', move, { excerpt: 'Shared source component' })
      const wrapper = mountHeader()
      await flushPromises()
      expect(wrapper.find('[data-testid="clone-mode-source"]').text()).toBe(expected)
    })

    test('with no excerpt, as for an image, the bar names only the type', async () => {
      const { cwa } = mockCwa({ admin: buildAdmin({ isEditing: true }) })
      useCloneMode(cwa).start(SOURCE_IRI, 'Image')
      const wrapper = mountHeader()
      await flushPromises()
      expect(wrapper.find('[data-testid="clone-mode-source"]').text()).toBe('Cloning: Image')
    })

    test('a move says Moving in the bar', async () => {
      const { cwa } = mockCwa({ admin: buildAdmin({ isEditing: true }) })
      useCloneMode(cwa).start(SOURCE_IRI, 'Hero text', { positionIri: '/_/component_positions/p1', fromLayout: false, from: { componentPosition: '/_/component_positions/p1' } })
      const wrapper = mountHeader()
      await flushPromises()
      expect(wrapper.find('[data-testid="clone-mode-bar"]').text()).toContain('Moving: Hero text')
      expect(wrapper.find('[data-testid="clone-mode-bar"]').text()).not.toContain('Cloning')
    })

    test('the Cloning bar sits in the header row, never over the layout below the header', async () => {
      const { cwa } = mockCwa({ admin: buildAdmin({ isEditing: true }) })
      useCloneMode(cwa).start(SOURCE_IRI, 'Hero text')
      const wrapper = mountHeader()
      await flushPromises()
      const refs = wrapper.vm.$refs as Record<string, HTMLElement>
      const bar = refs.header.querySelector('[data-testid="clone-mode-bar"]')!
      expect(bar.className).not.toContain('cwa:top-full')
      expect(bar.className).not.toContain('cwa:absolute')
      expect(bar.parentElement!.parentElement).toBe(refs.header.firstElementChild)
    })

    test.each([
      ['an error page', () => {
        errorRef.value = { statusCode: 404 }
      }],
      ['an admin page', () => {
        mockRouteMeta.cwa = { admin: true }
      }],
    ])('on %s, reached by Visit, the Cloning bar and its Cancel still show while clone mode is on', async (_label, arrive) => {
      arrive()
      const { cwa } = mockCwa({ admin: buildAdmin({ isEditing: true }) })
      useCloneMode(cwa).start(SOURCE_IRI, 'Hero text')
      const wrapper = mountHeader()
      await flushPromises()
      const bar = wrapper.find('[data-testid="clone-mode-bar"]')
      expect(bar.exists()).toBe(true)
      await bar.find('button').trigger('click')
      expect(useCloneMode(cwa).source.value).toBeUndefined()
    })

    test('the Cloning bar\'s help is one short line, as a click anywhere opens the placement menu and a link\'s Visit is in it', async () => {
      const { cwa } = mockCwa({ admin: buildAdmin({ isEditing: true }) })
      useCloneMode(cwa).start(SOURCE_IRI, 'Hero text')
      const wrapper = mountHeader()
      await flushPromises()
      expect(wrapper.find('[data-testid="clone-mode-hint"]').text()).toBe('Click where it should go')
    })

    test('mounts the clone highlight only while cloning or flashing what was placed', async () => {
      const { cwa } = mockCwa({ admin: buildAdmin({ isEditing: true }) })
      const wrapper = mountHeader()
      expect(wrapper.findComponent({ name: 'CloneHighlight' }).exists()).toBe(false)
      useCloneMode(cwa).start(SOURCE_IRI, 'Hero text')
      await flushPromises()
      expect(wrapper.findComponent({ name: 'CloneHighlight' }).exists()).toBe(true)
      useCloneMode(cwa).end()
      useCloneMode(cwa).showPlaced('/_/component_positions/new')
      await flushPromises()
      expect(wrapper.findComponent({ name: 'CloneHighlight' }).exists()).toBe(true)
      useCloneMode(cwa).start(SOURCE_IRI, 'Hero text')
      useCloneMode(cwa).end()
      await flushPromises()
      expect(wrapper.findComponent({ name: 'CloneHighlight' }).exists()).toBe(false)
    })

    test('Cancel in the Cloning bar ends clone mode', async () => {
      const { cwa } = mockCwa({ admin: buildAdmin({ isEditing: true }) })
      useCloneMode(cwa).start(SOURCE_IRI, 'Hero text')
      const wrapper = mountHeader()
      await wrapper.find('[data-testid="clone-mode-bar"] button').trigger('click')
      expect(useCloneMode(cwa).source.value).toBeUndefined()
      expect(wrapper.find('[data-testid="clone-mode-bar"]').exists()).toBe(false)
    })

    test('clone mode shows no Enable Navigation toggle', async () => {
      const { cwa } = mockCwa({ admin: buildAdmin({ isEditing: true }) })
      useCloneMode(cwa).start(SOURCE_IRI, 'Hero text')
      const wrapper = mountHeader()
      await flushPromises()
      expect(wrapper.text()).not.toContain('Enable Navigation')
      expect(wrapper.findComponent({ name: 'CwaUiToggle' }).exists()).toBe(false)
    })
  })

  describe('always-present children', () => {
    test('renders RequestErrors, OutdatedContentNotice and ResourceLoadingIndicator', () => {
      mockCwa()
      const wrapper = mountHeader()
      expect(wrapper.findComponent({ name: 'RequestErrors' }).exists()).toBe(true)
      expect(wrapper.findComponent({ name: 'OutdatedContentNotice' }).exists()).toBe(true)
      expect(wrapper.findComponent({ name: 'ResourceLoadingIndicator' }).exists()).toBe(true)
    })

    test.each([
      { name: 'on a page outside edit mode', admin: false, isEditing: false },
      { name: 'on a page in edit mode', admin: false, isEditing: true },
      { name: 'on an admin page', admin: true, isEditing: false },
    ])('shows who else is here $name (#429)', async ({ admin, isEditing }) => {
      mockRouteMeta.cwa = { admin }
      mockCwa({ admin: buildAdmin({ isEditing }) })
      const wrapper = mountHeader()
      await flushPromises()

      expect(wrapper.find('.presence-indicator-stub').exists()).toBe(true)
    })

    test.each([
      { name: 'in edit mode', isEditing: true },
      { name: 'outside edit mode, where no bar shows the field', isEditing: false },
    ])('loads the toasts for saves that failed out of the bar\'s reach $name (#461)', async ({ isEditing }) => {
      mockCwa({ admin: buildAdmin({ isEditing }) })
      const wrapper = mountHeader()
      await flushPromises()

      expect(wrapper.find('.failed-save-toasts-stub').exists()).toBe(true)
    })
  })

  void computed
})

describe('the header for the narrow admin roles (bundle #611)', () => {
  afterEach(() => {
    mockRouteMeta.cwa = { admin: false }
    errorRef.value = null
  })

  const adminLinks = (wrapper: ReturnType<typeof mountHeader>) => wrapper.findAll('[data-testid="header-centre"] a .cwa\\:sr-only').map(label => label.text())

  test('on an admin page a content admin who is not a user admin gets the content areas and no Users', () => {
    mockRouteMeta.cwa = { admin: true }
    mockCwa({ roles: ['ROLE_CMS_ADMIN', 'ROLE_USER'] })
    expect(adminLinks(mountHeader())).toEqual(['Back to the site', 'Layouts', 'Pages', 'Data', 'Routes'])
  })

  test('on an admin page a user admin who cannot edit content gets Users alone', () => {
    mockRouteMeta.cwa = { admin: true }
    mockCwa({ roles: ['ROLE_USER_ADMIN', 'ROLE_USER'] })
    expect(adminLinks(mountHeader())).toEqual(['Back to the site', 'Users'])
  })

  test('on a page of the site a user admin who cannot edit content gets no Edit and no page settings', () => {
    mockCwa({ roles: ['ROLE_USER_ADMIN', 'ROLE_USER'] })
    const wrapper = mountHeader()
    expect(wrapper.findAll('button').map(button => button.text())).not.toContain('Edit')
    expect(wrapper.find('[data-testid="page-settings"]').exists()).toBe(false)
    expect(wrapper.find('.menu-stub').exists()).toBe(true)
  })

  test('on a page of the site a content admin gets Edit', () => {
    mockCwa({ roles: ['ROLE_CMS_ADMIN', 'ROLE_USER'] })
    expect(mountHeader().findAll('button').map(button => button.text())).toContain('Edit')
  })
})
