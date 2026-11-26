// @vitest-environment nuxt
import { afterEach, describe, expect, test, vi } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { axe } from '../../../../../test/utils/axe'
import ExtensionsPage from './extensions.vue'
import * as cwaComposable from '#cwa/composables/cwa'

enableAutoUnmount(afterEach)

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

function mountAs(roles: string[]) {
  vi.spyOn(cwaComposable, 'useCwa').mockImplementation(() => ({ auth: { hasRole: (role: string) => roles.includes(role) } }) as never)
  return mount(ExtensionsPage, { attachTo: document.body })
}

function listed(wrapper: ReturnType<typeof mountAs>) {
  return wrapper.findAll('[data-testid="extension"]').map(item => ({
    label: item.find('[data-testid="extension-link"], [data-testid="extension-label"]').text(),
    description: item.find('[data-testid="extension-description"]').text(),
    to: item.find('[data-testid="extension-link"]').exists() ? item.findComponent({ name: 'NuxtLink' }).props('to') : undefined,
  }))
}

describe('the Extensions page', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  test('lists the extensions the user can open a page in, with label, description, icon and a link to the area', async () => {
    const wrapper = mountAs(['ROLE_SHOP_PAYMENTS'])

    expect(listed(wrapper)).toEqual([
      { label: 'E-commerce', description: 'Orders, products and payments', to: { name: '_cwa-ecommerce' } },
    ])
    expect(wrapper.find('[data-testid="extension-icon"] [data-testid="cart"]').exists()).toBe(true)
    expect(await axe(document.body.innerHTML)).toHaveNoViolations()
  })

  test('leaves out an extension none of whose pages the user can open', () => {
    const wrapper = mountAs(['ROLE_SHOP_ORDERS'])

    expect(listed(wrapper).map(extension => extension.label)).toEqual(['E-commerce'])
  })

  test('lists an extension with no admin pages without a link, for ROLE_ADMIN', async () => {
    const wrapper = mountAs(['ROLE_ADMIN'])

    expect(listed(wrapper)).toEqual([
      { label: 'Reports', description: 'Sales reports', to: { name: '_cwa-reports' } },
      { label: 'Badges', description: 'Trust badges for the footer', to: undefined },
    ])
    expect(await axe(document.body.innerHTML)).toHaveNoViolations()
  })

  test('shows the empty state when there is nothing to list', () => {
    const wrapper = mountAs(['ROLE_CMS_ADMIN'])

    expect(wrapper.findAll('[data-testid="extension"]')).toHaveLength(0)
    expect(wrapper.text()).toContain('No extensions')
  })
})
