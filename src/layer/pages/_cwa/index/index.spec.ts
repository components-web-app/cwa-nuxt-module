// @vitest-environment nuxt
import { describe, test, expect, vi, afterEach } from 'vitest'
import { computed, defineComponent, h } from 'vue'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { useRouter } from '#app/composables/router'
import CwaAdminParentPage from '../index.vue'
import DashboardPage from './index.vue'
import { axe } from '../../../../../test/utils/axe'
import * as cwaComposable from '#cwa/composables/cwa'
import IconLayouts from '#cwa/templates/components/core/assets/IconLayouts.vue'
import IconUsers from '#cwa/templates/components/core/assets/IconUsers.vue'
import IconComponents from '#cwa/templates/components/core/assets/IconComponents.vue'
import { adminShellRoles } from '#build/cwa-extension-menu'

const { mockNavigateTo, mockCwaAdminMiddleware, mockUseHead, mockHasPageDataTypes } = vi.hoisted(() => ({
  mockNavigateTo: vi.fn(),
  mockCwaAdminMiddleware: vi.fn(),
  mockUseHead: vi.fn(),
  mockHasPageDataTypes: vi.fn(),
}))

vi.mock('#cwa-layer/middleware/cwa-admin', () => ({ default: mockCwaAdminMiddleware }))
vi.mock('#cwa/admin/page-data-presence', () => ({ hasPageDataTypes: mockHasPageDataTypes }))
vi.mock('#build/cwa-extension-areas', () => ({
  extensionAreas: [
    { segment: 'ecommerce', label: 'E-commerce', description: 'Orders, products and payments', icon: '<svg data-testid="cart"></svg>', pages: [
      { path: 'orders', label: 'Orders', role: 'ROLE_SHOP_ORDERS' },
      { path: 'payments', label: 'Payments', role: 'ROLE_SHOP_PAYMENTS' },
    ] },
    { segment: 'reports', label: 'Reports', description: 'Sales reports', pages: [{ path: 'sales', label: 'Sales', role: 'ROLE_ADMIN' }] },
    { segment: 'badges', label: 'Badges', description: 'Trust badges for the footer', pages: [] },
  ],
}))

mockNuxtImport('navigateTo', () => mockNavigateTo)
mockNuxtImport('useHead', () => mockUseHead)

enableAutoUnmount(afterEach)

const NuxtLink = defineComponent({
  name: 'NuxtLink',
  props: { to: { type: [String, Object], required: true } },
  setup(props, { slots }) {
    return () => h('a', { href: typeof props.to === 'string' ? props.to : '#' }, slots.default?.())
  },
})

const CONTENT_ADMIN = ['ROLE_ADMIN', 'ROLE_CMS_ADMIN', 'ROLE_USER_ADMIN', 'ROLE_USER']

function stubCwa(roles: string[], navigationDisabled = false) {
  const signOut = vi.fn(async () => {})
  vi.spyOn(cwaComposable, 'useCwa').mockImplementation(() => ({
    navigationDisabled,
    auth: {
      hasRole: (role: string) => roles.includes(role),
      isAdmin: computed(() => roles.includes('ROLE_CMS_ADMIN')),
      signOut,
    },
  }) as never)
  return signOut
}

async function mountAs(roles: string[], { hasPageData = true, navigationDisabled = false } = {}) {
  mockHasPageDataTypes.mockImplementation(async () => hasPageData)
  const signOut = stubCwa(roles, navigationDisabled)
  const wrapper = mount(DashboardPage, { attachTo: document.body, global: { stubs: { NuxtLink } } })
  await flushPromises()
  return { wrapper, signOut }
}

type Dashboard = ReturnType<typeof mount>

function groups(wrapper: Dashboard) {
  return wrapper.findAll('h2').map(heading => heading.text())
}

function group(wrapper: Dashboard, name: string) {
  const section = wrapper.findAll('section').find(found => found.find('h2').text() === name)
  if (!section) {
    throw new Error(`No ${name} group`)
  }
  return section
}

function rows(section: ReturnType<typeof group>) {
  return section.findAll('li').map((item) => {
    const link = item.findComponent({ name: 'NuxtLink' })
    return {
      label: item.find('a, button, [data-testid="dashboard-row-label"]').text(),
      to: link.exists() ? link.props('to') : undefined,
    }
  })
}

describe('/_cwa', () => {
  afterEach(async () => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
    document.body.innerHTML = ''
    await useRouter().replace('/')
  })

  test('visiting /_cwa opens the Dashboard beneath the guarded /_cwa parent, so the parent\'s guard still runs', async () => {
    const router = useRouter()
    await router.push('/_cwa')
    expect(router.currentRoute.value.path).toBe('/_cwa')
    expect(router.currentRoute.value.matched).toHaveLength(2)
    expect(router.currentRoute.value.matched[0]!.meta.cwa).toEqual({ disabled: true, admin: true })
    expect(mockCwaAdminMiddleware).toHaveBeenCalledTimes(1)
    expect(mockCwaAdminMiddleware.mock.calls[0]![0].fullPath).toBe('/_cwa')
  })

  test('the Dashboard opens for everyone the admin header shows for, so a user with only an extension page\'s role is let in rather than sent home', () => {
    expect(useRouter().resolve('/_cwa').meta.cwaAdminRole).toEqual(adminShellRoles)
  })

  test('the Extensions page is gone: the Dashboard lists the extensions', () => {
    expect(useRouter().hasRoute('_cwa-extensions')).toBe(false)
  })

  test('runs the admin guard again on a move between two admin pages, so a page with a narrower role is never reached from one that allows more', async () => {
    const router = useRouter()
    await router.push('/_cwa/pages')
    mockCwaAdminMiddleware.mockClear()

    await router.push('/_cwa/routes')

    expect(mockCwaAdminMiddleware).toHaveBeenCalledTimes(1)
    expect(mockCwaAdminMiddleware.mock.calls[0]![0].fullPath).toBe('/_cwa/routes')
  })

  test('leaves who gets in to the cwa-admin guard, so a user the guard let in for an extension page\'s role is not sent home', async () => {
    mount(CwaAdminParentPage, { shallow: true })
    await flushPromises()
    expect(mockNavigateTo).not.toHaveBeenCalled()
  })
})

describe('the Dashboard', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  test('has one Dashboard heading and title, and a heading for each group', async () => {
    const { wrapper } = await mountAs(CONTENT_ADMIN)

    expect(wrapper.findAll('h1').map(heading => heading.text())).toEqual(['Dashboard'])
    expect(mockUseHead).toHaveBeenCalledWith({ title: 'Dashboard' })
    expect(groups(wrapper)).toEqual(['Areas', 'Installed', 'Site', 'Account'])
    expect(await axe(document.body.innerHTML)).toHaveNoViolations()
  })

  test('lists the built-in areas, then the extensions with pages, each with its link and description', async () => {
    const { wrapper } = await mountAs(CONTENT_ADMIN)

    expect(rows(group(wrapper, 'Areas'))).toEqual([
      { label: 'Layouts', to: '/_cwa/layouts' },
      { label: 'Pages', to: '/_cwa/pages' },
      { label: 'Data', to: '/_cwa/data' },
      { label: 'Routes', to: '/_cwa/routes' },
      { label: 'Users', to: '/_cwa/users' },
      { label: 'Reports', to: { name: '_cwa-reports' } },
    ])
    expect(group(wrapper, 'Areas').text()).toContain('The shared layouts around your pages.')
    expect(group(wrapper, 'Areas').text()).toContain('Sales reports')
  })

  test('ties each description to its link without putting it in the link\'s name, and makes the whole row the link\'s target', async () => {
    const { wrapper } = await mountAs(CONTENT_ADMIN)

    const row = group(wrapper, 'Areas').findAll('li')[0]!
    const link = row.find('a')
    expect(link.text()).toBe('Layouts')
    const description = row.find(`#${link.attributes('aria-describedby')}`)
    expect(description.text()).toBe('The shared layouts around your pages.')
    expect(link.element.contains(description.element)).toBe(false)
    expect(row.classes()).toContain('cwa:relative')
    expect(link.classes()).toContain('cwa:after:inset-0')
  })

  test('shows a built-in area with the header\'s icon, an extension with its own SVG, and one without an icon with a generic one, all hidden from assistive technology', async () => {
    const { wrapper } = await mountAs([...CONTENT_ADMIN, 'ROLE_SHOP_ORDERS'])

    const areaRows = group(wrapper, 'Areas').findAll('li')
    expect(areaRows[0]!.findComponent(IconLayouts).exists()).toBe(true)
    expect(areaRows[4]!.findComponent(IconUsers).exists()).toBe(true)
    const ecommerce = areaRows.find(row => row.text().includes('E-commerce'))!
    expect(ecommerce.find('[data-testid="cart"]').exists()).toBe(true)
    const reports = areaRows.find(row => row.text().includes('Reports'))!
    expect(reports.findComponent(IconComponents).exists()).toBe(true)
    for (const row of areaRows) {
      expect(row.find('[data-testid="dashboard-row-icon"]').attributes('aria-hidden')).toBe('true')
    }
  })

  test('leaves Data out until the API docs show page data types', async () => {
    let answer: (found: boolean) => void = () => {}
    mockHasPageDataTypes.mockImplementation(() => new Promise<boolean>((resolve) => {
      answer = resolve
    }))
    stubCwa(CONTENT_ADMIN)
    const wrapper = mount(DashboardPage, { attachTo: document.body, global: { stubs: { NuxtLink } } })
    await flushPromises()

    expect(rows(group(wrapper, 'Areas')).map(row => row.label)).not.toContain('Data')
    expect(mockHasPageDataTypes).toHaveBeenCalledTimes(1)

    answer(true)
    await flushPromises()
    expect(rows(group(wrapper, 'Areas')).map(row => row.label)).toContain('Data')
  })

  test('never shows Data when there are no page data types', async () => {
    const { wrapper } = await mountAs(CONTENT_ADMIN, { hasPageData: false })

    expect(rows(group(wrapper, 'Areas')).map(row => row.label)).not.toContain('Data')
  })

  test('lists extensions with no pages under Installed, without a link, for ROLE_ADMIN', async () => {
    const { wrapper } = await mountAs(CONTENT_ADMIN)

    expect(rows(group(wrapper, 'Installed'))).toEqual([{ label: 'Badges', to: undefined }])
    expect(group(wrapper, 'Installed').text()).toContain('Trust badges for the footer')
    expect(group(wrapper, 'Installed').find('a').exists()).toBe(false)
  })

  test('leaves Installed out for a user without ROLE_ADMIN', async () => {
    const { wrapper } = await mountAs(['ROLE_CMS_ADMIN', 'ROLE_USER'])

    expect(groups(wrapper)).toEqual(['Areas', 'Site', 'Account'])
  })

  test('a user with only an extension page\'s role sees only that area and Account, and is not sent to Pages', async () => {
    const { wrapper } = await mountAs(['ROLE_SHOP_PAYMENTS', 'ROLE_USER'])

    expect(groups(wrapper)).toEqual(['Areas', 'Account'])
    expect(rows(group(wrapper, 'Areas'))).toEqual([{ label: 'E-commerce', to: { name: '_cwa-ecommerce' } }])
    expect(mockNavigateTo).not.toHaveBeenCalled()
    expect(await axe(document.body.innerHTML)).toHaveNoViolations()
  })

  test('Site links to Site settings for a content admin', async () => {
    const { wrapper } = await mountAs(CONTENT_ADMIN)

    expect(rows(group(wrapper, 'Site'))).toEqual([{ label: 'Site settings', to: { name: '_cwa-settings' } }])
  })

  test('Account links to My account and its quick links section, and signs out with a button', async () => {
    const { wrapper, signOut } = await mountAs(CONTENT_ADMIN)

    expect(rows(group(wrapper, 'Account'))).toEqual([
      { label: 'My account', to: { name: '_cwa-account' } },
      { label: 'Edit quick links', to: { name: '_cwa-account', hash: '#quick-links' } },
      { label: 'Sign out', to: undefined },
    ])
    const button = group(wrapper, 'Account').find('button')
    expect(button.text()).toBe('Sign out')
    expect(button.attributes('type')).toBe('button')
    await button.trigger('click')
    expect(signOut).toHaveBeenCalledTimes(1)
  })

  test('does not sign out while navigation is disabled', async () => {
    const { wrapper, signOut } = await mountAs(CONTENT_ADMIN, { navigationDisabled: true })

    await group(wrapper, 'Account').find('button').trigger('click')
    expect(signOut).not.toHaveBeenCalled()
  })
})
