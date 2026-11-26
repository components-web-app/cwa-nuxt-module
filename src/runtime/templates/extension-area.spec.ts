// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import ExtensionArea from './extension-area.vue'
import { axe } from '../../../test/utils/axe'

const mocks = vi.hoisted(() => ({ route: null as any, push: vi.fn(), roles: [] as string[] }))

vi.mock('vue-router', async (importOriginal) => {
  const { reactive } = await import('vue')
  mocks.route = reactive({ name: '', matched: [] as { name: string }[] })
  const mod = await importOriginal<typeof import('vue-router')>()
  return { ...mod, useRoute: () => mocks.route, useRouter: () => ({ push: mocks.push }) }
})
vi.mock('#cwa/composables/cwa', () => ({
  useCwa: () => ({ auth: { hasRole: (role: string) => mocks.roles.includes(role) } }),
}))
vi.mock('#build/cwa-extension-areas', () => ({
  extensionAreas: [{
    segment: 'ecommerce',
    label: 'E-commerce',
    pages: [
      { path: 'orders', label: 'Orders', role: 'ROLE_ADMIN' },
      { path: 'products', label: 'Products', role: 'ROLE_SHOP_PRODUCTS' },
      { path: 'payments', label: 'Payments', role: 'ROLE_ADMIN' },
    ],
  }],
}))

const LinkStub = defineComponent({
  props: { to: { type: Object, required: true } },
  setup(props, { slots }) {
    return () => h('a', { 'href': `#${props.to.name}`, 'data-to': props.to.name }, slots.default?.())
  },
})

function at(...names: string[]) {
  mocks.route.name = names.at(-1)
  mocks.route.matched = [{ name: undefined }, ...names.map(name => ({ name }))]
}

function mountArea() {
  return mount(ExtensionArea, {
    attachTo: document.body,
    global: { stubs: { NuxtLink: LinkStub, NuxtPage: { template: '<p>page</p>' } } },
  })
}

function tabs() {
  return [...document.querySelectorAll<HTMLElement>('[role="tab"]')]
}

afterEach(() => {
  document.body.innerHTML = ''
  mocks.push.mockReset()
  mocks.roles = []
})

describe('an extension area', () => {
  test('has the extension\'s label as its heading, and a tab for each page the user can open, in declared order', async () => {
    mocks.roles = ['ROLE_ADMIN']
    at('_cwa-ecommerce', '_cwa-ecommerce-orders')
    const wrapper = mountArea()

    expect(wrapper.get('h1').text()).toBe('E-commerce')
    expect(wrapper.get('[role="tablist"]').attributes('aria-label')).toBe('E-commerce')
    expect(tabs().map(tab => tab.textContent?.trim())).toEqual(['Orders', 'Payments'])
    expect(tabs().map(tab => tab.dataset.to)).toEqual(['_cwa-ecommerce-orders', '_cwa-ecommerce-payments'])
    expect(await axe(document.body.innerHTML)).toHaveNoViolations()
  })

  test('lists every page for a user with every role', () => {
    mocks.roles = ['ROLE_ADMIN', 'ROLE_SHOP_PRODUCTS']
    at('_cwa-ecommerce', '_cwa-ecommerce-orders')
    mountArea()

    expect(tabs().map(tab => tab.textContent?.trim())).toEqual(['Orders', 'Products', 'Payments'])
  })

  test('selects the current page\'s tab, also while its item dialog is open, and labels the page panel by it', async () => {
    mocks.roles = ['ROLE_ADMIN', 'ROLE_SHOP_PRODUCTS']
    at('_cwa-ecommerce', '_cwa-ecommerce-payments')
    const wrapper = mountArea()

    expect(tabs().map(tab => tab.getAttribute('aria-selected'))).toEqual(['false', 'false', 'true'])
    expect(tabs().map(tab => tab.getAttribute('tabindex'))).toEqual(['-1', '-1', '0'])
    expect(wrapper.get('[role="tabpanel"]').attributes('aria-labelledby')).toBe(tabs()[2]!.id)

    at('_cwa-ecommerce', '_cwa-ecommerce-orders', '_cwa-ecommerce-orders-iri')
    await flushPromises()
    expect(tabs().map(tab => tab.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false'])
  })

  test('the arrow keys, Home and End move to another tab, opening its page and focusing it, wrapping at the ends', async () => {
    mocks.roles = ['ROLE_ADMIN', 'ROLE_SHOP_PRODUCTS']
    at('_cwa-ecommerce', '_cwa-ecommerce-orders')
    mountArea()

    tabs()[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    await flushPromises()
    expect(mocks.push).toHaveBeenLastCalledWith({ name: '_cwa-ecommerce-products' })
    expect(document.activeElement).toBe(tabs()[1])

    tabs()[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }))
    await flushPromises()
    expect(mocks.push).toHaveBeenLastCalledWith({ name: '_cwa-ecommerce-payments' })
    expect(document.activeElement).toBe(tabs()[2])

    tabs()[2]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }))
    await flushPromises()
    expect(mocks.push).toHaveBeenLastCalledWith({ name: '_cwa-ecommerce-orders' })

    mocks.push.mockClear()
    tabs()[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }))
    await flushPromises()
    expect(mocks.push).not.toHaveBeenCalled()
  })
})
