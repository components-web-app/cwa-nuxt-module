// @vitest-environment nuxt
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { computed, reactive } from 'vue'
import { flushPromises, mount, renderToString } from '@vue/test-utils'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import CwaRootLayout from './CwaRootLayout.vue'
import OutdatedContentNotice from '#cwa/templates/components/main/admin/header/_parts/OutdatedContentNotice.vue'
import * as cwaComposable from '#cwa/composables/cwa'

const styleClasses = vi.hoisted(() => ({
  CwaLayoutPrimary: { blue: 'bg-blue-600' },
  CwaLayoutSecondary: { dark: 'bg-black' },
}))
vi.mock('#build/cwa-styles', () => ({ styleClasses }))
vi.mock('#build/cwa-extension-menu', () => ({
  extensionMenu: [{ label: 'Orders', to: { name: '_cwa-orders' }, role: 'ROLE_SHOP_ADMIN' }],
}))

const headOptions: Record<string, any>[] = []
const mockUseHead = vi.hoisted(() => vi.fn())
mockNuxtImport('useHead', () => mockUseHead)

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
  const { ref: vueRef } = await import('vue')
  return {
    ...actual,
    useRouter: () => ({ currentRoute: vueRef({ meta: {} }) }),
  }
})

type SetupOpts = {
  concatTitle?: boolean
  uiComponent?: string
  uiClassNames?: string[]
  layoutIri?: string
  registeredComponents?: string[]
  isAdmin?: boolean
  roles?: string[]
  isEditing?: boolean
  stubs?: Record<string, unknown>
}

function mockCwa(opts: SetupOpts) {
  headOptions.length = 0
  mockUseHead.mockImplementation((options: Record<string, any>) => {
    headOptions.push(options)
  })

  const state = reactive({ concatTitle: opts.concatTitle ?? false, siteName: 'Site' })
  const merged = computed(() => ({ ...state }))

  vi.spyOn(cwaComposable, 'useCwa').mockImplementation(() => ({
    auth: { isAdmin: computed(() => opts.isAdmin ?? false), hasRole: (role: string) => (opts.roles ?? []).includes(role) },
    admin: reactive({ isEditing: opts.isEditing ?? false }),
    resources: {
      layout: computed(() => opts.uiComponent ? { data: { uiComponent: opts.uiComponent, uiClassNames: opts.uiClassNames } } : undefined),
      layoutIri: computed(() => opts.layoutIri),
    },
    siteConfig: {
      get config() {
        return merged.value
      },
    },
  } as unknown as ReturnType<typeof cwaComposable.useCwa>))
  return state
}

function mountOptions(opts: SetupOpts) {
  return {
    slots: { default: '<div class="page-content" />' },
    global: {
      components: Object.fromEntries((opts.registeredComponents ?? []).map(name => [name, { name, template: '<div><slot /></div>' }])),
      stubs: {
        ClientOnly: { template: '<div><slot /></div>' },
        teleport: true,
        ...opts.stubs,
      },
    },
  }
}

function setup(opts: SetupOpts = {}) {
  const state = mockCwa(opts)
  const wrapper = mount(CwaRootLayout, { shallow: true, ...mountOptions(opts) })

  const titleTemplate = headOptions.find(o => o.titleTemplate)?.titleTemplate
  return { wrapper, state, titleTemplate }
}

describe('CwaRootLayout titleTemplate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('uses the plain template when concatTitle is off', () => {
    const { titleTemplate } = setup({ concatTitle: false })
    expect(titleTemplate).toBeTypeOf('function')
    expect(titleTemplate()).toBe('%s')
  })

  test('concatenates the site name when concatTitle is on', () => {
    const { titleTemplate } = setup({ concatTitle: true })
    expect(titleTemplate()).toBe('%s %separator %siteName')
  })

  test('reacts to the site config changing after mount', async () => {
    const { state, titleTemplate } = setup({ concatTitle: false })
    expect(titleTemplate()).toBe('%s')

    state.concatTitle = true
    expect(titleTemplate()).toBe('%s %separator %siteName')

    state.concatTitle = false
    expect(titleTemplate()).toBe('%s')
  })
})

describe('CwaRootLayout admin overlay', () => {
  function hasOverlay(wrapper: ReturnType<typeof setup>['wrapper']) {
    return wrapper.findAll('*').some(el => el.attributes('page') !== undefined && el.attributes('layout') !== undefined)
  }

  test('renders the layout page overlay for an admin who is editing', async () => {
    const { wrapper } = setup({ isAdmin: true, isEditing: true, registeredComponents: ['CwaLayoutPrimary'] })
    const mountedAt = Date.now()
    await flushPromises()
    await vi.waitFor(() => expect(Date.now()).toBeGreaterThan(mountedAt))
    expect(hasOverlay(wrapper)).toBe(true)
  })

  test('renders no layout page overlay when not editing', async () => {
    const { wrapper } = setup({ isAdmin: true, isEditing: false, registeredComponents: ['CwaLayoutPrimary'] })
    await flushPromises()
    expect(hasOverlay(wrapper)).toBe(false)
  })
})

describe('CwaRootLayout for the narrow admin roles (bundle #611)', () => {
  const shows = (wrapper: ReturnType<typeof setup>['wrapper'], name: 'LazyCwaAdminHeader' | 'LazyCwaAdminResourceManager') => name === 'LazyCwaAdminHeader'
    ? !wrapper.findComponent(OutdatedContentNotice).exists()
    : !!wrapper.element.lastElementChild?.querySelector('asynccomponentwrapper-stub')

  test('a user admin who cannot edit content gets the admin header, for its menu, and no resource manager', async () => {
    const { wrapper } = setup({ isAdmin: false, roles: ['ROLE_USER_ADMIN', 'ROLE_USER'], registeredComponents: ['CwaLayoutPrimary'] })
    await flushPromises()
    expect(shows(wrapper, 'LazyCwaAdminHeader')).toBe(true)
    expect(shows(wrapper, 'LazyCwaAdminResourceManager')).toBe(false)
  })

  test('a content admin gets the header and the resource manager', async () => {
    const { wrapper } = setup({ isAdmin: true, roles: ['ROLE_CMS_ADMIN', 'ROLE_USER'], registeredComponents: ['CwaLayoutPrimary'] })
    await flushPromises()
    expect(shows(wrapper, 'LazyCwaAdminHeader')).toBe(true)
    expect(shows(wrapper, 'LazyCwaAdminResourceManager')).toBe(true)
  })

  test('a signed-in user with neither role gets neither', async () => {
    const { wrapper } = setup({ isAdmin: false, roles: ['ROLE_USER'], registeredComponents: ['CwaLayoutPrimary'] })
    await flushPromises()
    expect(shows(wrapper, 'LazyCwaAdminHeader')).toBe(false)
    expect(shows(wrapper, 'LazyCwaAdminResourceManager')).toBe(false)
  })
  test('a user whose only admin role is one an extension admin page needs gets the header, for its menu, and no resource manager', async () => {
    const { wrapper } = setup({ isAdmin: false, roles: ['ROLE_SHOP_ADMIN', 'ROLE_USER'], registeredComponents: ['CwaLayoutPrimary'] })
    await flushPromises()
    expect(shows(wrapper, 'LazyCwaAdminHeader')).toBe(true)
    expect(shows(wrapper, 'LazyCwaAdminResourceManager')).toBe(false)
  })

  test('a role no extension admin page needs gets no header', async () => {
    const { wrapper } = setup({ isAdmin: false, roles: ['ROLE_SHOP_CUSTOMER', 'ROLE_USER'], registeredComponents: ['CwaLayoutPrimary'] })
    await flushPromises()
    expect(shows(wrapper, 'LazyCwaAdminHeader')).toBe(false)
  })
})

describe('CwaRootLayout unresolvable uiComponent', () => {
  const UNRESOLVABLE = 'CwaLayoutDeletedByApp'
  const LAYOUT_IRI = '/_/layouts/abc-123'

  test('renders a warning naming the component and the layout resource', () => {
    const { wrapper } = setup({ uiComponent: UNRESOLVABLE, layoutIri: LAYOUT_IRI, registeredComponents: ['CwaLayoutPrimary'] })
    const alert = wrapper.findComponent({ name: 'CwaUiAlertWarning' })
    expect(alert.exists()).toBe(true)
    expect(alert.text()).toContain(UNRESOLVABLE)
    expect(alert.text()).toContain(LAYOUT_IRI)
  })

  test('falls back to the default layout instead of emitting an unknown element', () => {
    const { wrapper } = setup({ uiComponent: UNRESOLVABLE, layoutIri: LAYOUT_IRI, registeredComponents: ['CwaLayoutPrimary'] })
    // the OPENING TAG specifically - the name legitimately appears in the warning text
    expect(wrapper.html().toLowerCase()).not.toContain(`<${UNRESOLVABLE.toLowerCase()}`)
    expect(wrapper.find('.page-content').exists()).toBe(true)
  })

  test('does not warn when the uiComponent resolves', () => {
    const { wrapper } = setup({ uiComponent: 'CwaLayoutPrimary', layoutIri: LAYOUT_IRI, registeredComponents: ['CwaLayoutPrimary'] })
    expect(wrapper.findComponent({ name: 'CwaUiAlertWarning' }).exists()).toBe(false)
    expect(wrapper.find('.page-content').exists()).toBe(true)
  })

  test('does not warn when there is no named layout at all', () => {
    const { wrapper } = setup({ registeredComponents: ['CwaLayoutPrimary'] })
    expect(wrapper.findComponent({ name: 'CwaUiAlertWarning' }).exists()).toBe(false)
    expect(wrapper.find('.page-content').exists()).toBe(true)
  })
})

describe('CwaRootLayout style keys (#453)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function render(opts: SetupOpts) {
    mockCwa(opts)
    return renderToString(CwaRootLayout, mountOptions({ ...opts, stubs: { LazyCwaAdminHeader: true, OutdatedContentNotice: true, ...opts.stubs } }))
  }

  test('the server render of the layout resolves the stored keys against the layout\'s own styles', async () => {
    const html = await render({ uiComponent: 'CwaLayoutPrimary', uiClassNames: ['style:blue', 'style:dark'], layoutIri: '/_/layouts/1', registeredComponents: ['CwaLayoutPrimary', 'CwaLayoutSecondary'] })

    expect(html).toContain('<div class="cwa:relative bg-blue-600">')
    expect(html).not.toContain('bg-black')
    expect(html).not.toContain('style:')
  })

  test('another layout resolves the same keys against its own styles', async () => {
    const html = await render({ uiComponent: 'CwaLayoutSecondary', uiClassNames: ['style:blue', 'style:dark'], layoutIri: '/_/layouts/1', registeredComponents: ['CwaLayoutPrimary', 'CwaLayoutSecondary'] })

    expect(html).toContain('<div class="cwa:relative bg-black">')
    expect(html).not.toContain('bg-blue-600')
  })
})

describe('CwaRootLayout page or layout click', () => {
  async function setupClicks() {
    const clickHandler = vi.fn()
    const contextMenuHandler = vi.fn()
    const { wrapper } = setup({ isAdmin: true, isEditing: true, registeredComponents: ['CwaLayoutPrimary'] })
    const mountedAt = Date.now()
    await flushPromises()
    await vi.waitFor(() => expect(Date.now()).toBeGreaterThan(mountedAt))
    const setupState = (wrapper.vm as unknown as { $: { setupState: Record<string, unknown> } }).$.setupState
    setupState.resourceManager = { clickHandler, contextMenuHandler }
    return { wrapper, clickHandler, contextMenuHandler }
  }

  function removedByItsOwnClick(element: Element) {
    element.addEventListener('click', () => element.remove())
    element.addEventListener('contextmenu', () => element.remove())
  }

  test('a click on an in-page editor that replaces the clicked element is still a page click, not a layout one (#461)', async () => {
    const { wrapper, clickHandler, contextMenuHandler } = await setupClicks()
    const content = wrapper.find('.page-content').element
    const target = document.createElement('span')
    content.appendChild(target)
    removedByItsOwnClick(target)

    target.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(target.isConnected).toBe(false)
    expect(clickHandler).toHaveBeenCalledWith(expect.any(MouseEvent), 'page')

    const again = document.createElement('span')
    content.appendChild(again)
    removedByItsOwnClick(again)
    again.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }))
    expect(contextMenuHandler).toHaveBeenCalledWith(expect.any(MouseEvent), 'page')
  })

  test('a click outside the page is a layout click', async () => {
    const { wrapper, clickHandler } = await setupClicks()

    wrapper.element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(clickHandler).toHaveBeenCalledWith(expect.any(MouseEvent), 'layout')
  })
})
