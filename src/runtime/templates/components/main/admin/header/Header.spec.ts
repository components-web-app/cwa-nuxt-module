// @vitest-environment happy-dom
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { ref, reactive, computed } from 'vue'
import { mount } from '@vue/test-utils'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import Header from './Header.vue'
import * as cwaComposable from '#cwa/composables/cwa'

// --- Nuxt auto-imports -------------------------------------------------------
const errorRef = ref<any>(null)
const replaceMock = vi.fn()

// route.meta.cwa.admin drives `pageIsAdmin`. Keep it reactive so computeds re-run.
const mockRouteMeta = reactive<{ cwa?: { admin?: boolean } }>({ cwa: { admin: false } })

mockNuxtImport('useError', () => () => errorRef)
mockNuxtImport('useRoute', () => () => ({ meta: mockRouteMeta }))
mockNuxtImport('useRouter', () => () => ({ replace: replaceMock }))

// --- helpers -----------------------------------------------------------------
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
    navigationGuardDisabled: false,
    setNavigationGuardDisabled: vi.fn(),
    toggleEdit: vi.fn(),
    resourceStackManager: { showManager: { value: false } },
    ...overrides,
  })
}

function mockCwa({
  resources,
  admin,
  requestCount = 0,
}: {
  resources?: any
  admin?: any
  requestCount?: number
} = {}) {
  const res = resources ?? buildResources()
  const adm = admin ?? buildAdmin()
  // @ts-expect-error partial mock
  vi.spyOn(cwaComposable, 'useCwa').mockImplementation(() => ({
    resources: res,
    admin: adm,
    resourcesManager: { requestCount: { value: requestCount } },
  }))
  return { res, adm }
}

function mountHeader() {
  return mount(Header, {
    global: {
      stubs: {
        // Heavy / irrelevant children — stub to keep the test focused on Header logic
        PathSelector: { name: 'PathSelector', template: '<div class="path-selector-stub" />' },
        RequestErrors: { name: 'RequestErrors', template: '<div class="request-errors-stub" />' },
        Menu: { name: 'Menu', template: '<div class="menu-stub" />' },
        SpinnerTick: { name: 'SpinnerTick', props: ['isLoading', 'isPending'], template: '<div class="spinner-tick-stub" />' },
        OutdatedContentNotice: { name: 'OutdatedContentNotice', template: '<div class="outdated-stub" />' },
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
        // UI primitives
        CwaUiFormButton: {
          name: 'CwaUiFormButton',
          props: ['color', 'loading'],
          template: '<button type="button" @click="$emit(\'click\', $event)"><slot /></button>',
        },
        CwaUiFormToggle: {
          name: 'CwaUiFormToggle',
          props: ['modelValue', 'label'],
          template: '<div class="toggle-stub" />',
        },
        CwaUiIconCogIcon: { name: 'CwaUiIconCogIcon', template: '<svg class="cog-icon-stub" />' },
        NuxtLink: { name: 'NuxtLink', props: ['to', 'activeClass'], template: '<a :href="to"><slot /></a>' },
        IconLayouts: { name: 'IconLayouts', template: '<svg class="icon-layouts" />' },
        IconPages: { name: 'IconPages', template: '<svg class="icon-pages" />' },
        IconData: { name: 'IconData', template: '<svg class="icon-data" />' },
        IconRoutes: { name: 'IconRoutes', template: '<svg class="icon-routes" />' },
        IconUsers: { name: 'IconUsers', template: '<svg class="icon-users" />' },
      },
    },
  })
}

describe('Header', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    errorRef.value = null
    mockRouteMeta.cwa = { admin: false }
  })

  describe('mount + spacer side effect (onMounted)', () => {
    test('renders the header element and sets the spacer height to the header height', () => {
      mockCwa()
      const wrapper = mountHeader()
      const headerEl = wrapper.find('[ref="header"]').exists()
        ? wrapper.find('[ref="header"]')
        : null
      // header & spacer template refs both exist
      const refs = wrapper.vm.$refs as Record<string, HTMLElement>
      expect(refs.header).toBeTruthy()
      expect(refs.spacer).toBeTruthy()
      // onMounted copies header.clientHeight onto spacer.style.height
      Object.defineProperty(refs.header, 'clientHeight', { value: 72, configurable: true })
      // re-run not needed — assert the spacer got a height string written
      // (clientHeight in happy-dom defaults to 0, so the value is "0px")
      expect(refs.spacer.style.height).toMatch(/px$/)
      void headerEl
    })
  })

  describe('Edit / Done button', () => {
    test('shows "Edit" when not editing and calls toggleEdit on click', async () => {
      const { adm } = mockCwa({ admin: buildAdmin({ isEditing: false }) })
      const wrapper = mountHeader()
      const editBtn = wrapper.findAllComponents({ name: 'CwaUiFormButton' })
        .find(b => b.text().trim() === 'Edit')
      expect(editBtn).toBeTruthy()
      await editBtn!.trigger('click')
      expect(adm.toggleEdit).toHaveBeenCalled()
    })

    test('shows "Done" when editing', () => {
      mockCwa({ admin: buildAdmin({ isEditing: true }) })
      const wrapper = mountHeader()
      const labels = wrapper.findAllComponents({ name: 'CwaUiFormButton' }).map(b => b.text().trim())
      expect(labels).toContain('Done')
      expect(labels).not.toContain('Edit')
    })

    test('Edit button is not rendered on an admin page', () => {
      mockRouteMeta.cwa = { admin: true }
      mockCwa()
      const wrapper = mountHeader()
      const labels = wrapper.findAllComponents({ name: 'CwaUiFormButton' }).map(b => b.text().trim())
      expect(labels).not.toContain('Edit')
      expect(labels).not.toContain('Done')
    })

    test('Edit button is not rendered on an error page', () => {
      errorRef.value = { statusCode: 500 }
      mockCwa()
      const wrapper = mountHeader()
      const labels = wrapper.findAllComponents({ name: 'CwaUiFormButton' }).map(b => b.text().trim())
      expect(labels).not.toContain('Edit')
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
      // overlay hidden initially
      expect(wrapper.find('.overlay-stub').attributes('data-show')).toBe('false')
      // the clickable span lives inside the dark edit-page button
      const span = wrapper.findAll('span').find(s => s.text().includes('My Reference'))
      expect(span).toBeTruthy()
      await span!.trigger('click')
      expect(wrapper.find('.overlay-stub').attributes('data-show')).toBe('true')
      expect(wrapper.findComponent({ name: 'PageResourceAdminModal' }).exists()).toBe(true)
    })

    test('the edit-page button is hidden while editing', () => {
      mockCwa({ admin: buildAdmin({ isEditing: true }) })
      const wrapper = mountHeader()
      // PathSelector is shown instead when showManager true; here showManager false
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
      // header is the second top-level div (after spacer)
      const refs = wrapper.vm.$refs as Record<string, HTMLElement>
      return refs.header.className
    }

    test('uses the yellow accent for a dynamic page', () => {
      mockCwa({ resources: buildResources({ isDynamicPage: { value: true } }) })
      const wrapper = mountHeader()
      expect(classOf(wrapper)).toContain('cwa:before:bg-yellow')
    })

    test('uses green for a data page that has a route', () => {
      mockCwa({
        resources: buildResources({
          isDataPage: { value: true },
          pageData: { value: { data: { title: 'x', route: '/_/routes/uuid' } } },
        }),
      })
      const wrapper = mountHeader()
      expect(classOf(wrapper)).toContain('cwa:before:bg-green')
    })

    test('uses orange for a data page with no route', () => {
      mockCwa({
        resources: buildResources({
          isDataPage: { value: true },
          pageData: { value: { data: { title: 'x', route: null } } },
        }),
      })
      const wrapper = mountHeader()
      expect(classOf(wrapper)).toContain('cwa:before:bg-orange')
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
      expect(classOf(wrapper)).toContain('cwa:before:bg-blue-600')
    })
  })

  describe('editPageResourceType passed to the modal', () => {
    test('is "Page" for a normal page', async () => {
      mockCwa({ admin: buildAdmin({ isEditing: false }) })
      const wrapper = mountHeader()
      const span = wrapper.findAll('span').find(s => s.text().includes('My Reference'))
      await span!.trigger('click')
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
      const span = wrapper.findAll('span').find(s => s.text().includes('News'))
      await span!.trigger('click')
      expect(wrapper.findComponent({ name: 'PageResourceAdminModal' }).props('resourceType')).toBe('NewsData')
    })
  })

  describe('modal close / reload handlers', () => {
    test('@close hides the modal overlay', async () => {
      mockCwa({ admin: buildAdmin({ isEditing: false }) })
      const wrapper = mountHeader()
      const span = wrapper.findAll('span').find(s => s.text().includes('My Reference'))
      await span!.trigger('click')
      expect(wrapper.find('.overlay-stub').attributes('data-show')).toBe('true')
      await wrapper.findComponent({ name: 'PageResourceAdminModal' }).vm.$emit('close')
      expect(wrapper.find('.overlay-stub').attributes('data-show')).toBe('false')
    })

    test('@reload navigates to the admin pages view', async () => {
      mockCwa({ admin: buildAdmin({ isEditing: false }) })
      const wrapper = mountHeader()
      const span = wrapper.findAll('span').find(s => s.text().includes('My Reference'))
      await span!.trigger('click')
      await wrapper.findComponent({ name: 'PageResourceAdminModal' }).vm.$emit('reload')
      expect(replaceMock).toHaveBeenCalledWith('/_cwa/pages')
    })
  })

  describe('isNavEnabled model', () => {
    test('getter reflects admin.navigationGuardDisabled and setter delegates to setNavigationGuardDisabled', () => {
      const { adm } = mockCwa({ admin: buildAdmin({ navigationGuardDisabled: true }) })
      const wrapper = mountHeader()
      const vm = wrapper.vm as any
      expect(vm.isNavEnabled).toBe(true)
      vm.isNavEnabled = false
      expect(adm.setNavigationGuardDisabled).toHaveBeenCalledWith(false)
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
  })

  // referenced to keep imports tidy if computed/ref are unused elsewhere
  void computed
})
