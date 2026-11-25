// @vitest-environment nuxt
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { computed, reactive } from 'vue'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import * as cwaComposable from '#cwa/composables/cwa'
import Orders from './orders.vue'
import Order from './order.vue'

enableAutoUnmount(afterEach)

const mocks = vi.hoisted(() => ({ route: null as any, push: vi.fn(), replace: vi.fn(), confirm: vi.fn(), toast: vi.fn() }))

vi.mock('vue-router', async (importOriginal) => {
  const { reactive } = await import('vue')
  mocks.route = reactive({ name: '_cwa-fixture-orders', params: {} as Record<string, string>, query: {} as Record<string, unknown>, hash: '' })
  const mod = await importOriginal<typeof import('vue-router')>()
  return { ...mod, useRoute: () => mocks.route, useRouter: () => ({ push: mocks.push, replace: mocks.replace }) }
})

vi.mock('#cwa/composables/cwa-confirm', () => ({ useCwaConfirm: () => mocks.confirm }))
vi.mock('#cwa/composables/cwa-toast', () => ({ useCwaToast: () => ({ show: mocks.toast, dismiss: vi.fn() }) }))

const ORDER = '/fixture/orders/1'
const paid = { '@id': ORDER, '@type': 'Order', '_metadata': { persisted: true }, 'number': 'SBP-1', 'state': 'paid', 'customerEmail': 'reader@example.com', 'total': 1299, 'currency': 'GBP', 'lines': [{ title: 'A book', quantity: 1, total: 1299 }] }

function cwa(order: Record<string, unknown>) {
  const store = reactive<Record<string, any>>({ [ORDER]: { data: { ...order }, apiState: { status: 'SUCCESS' } } })
  const errors = reactive<any[]>([])
  const send = vi.fn(async () => undefined)
  const fetchResource = vi.fn()
  const fetch = vi.fn(() => ({ response: Promise.resolve({ _data: { member: [order], totalItems: 1 } }) }))
  // @ts-expect-error a partial Cwa
  vi.spyOn(cwaComposable, 'useCwa').mockImplementation(() => ({
    fetch,
    fetchResource,
    resources: { getResource: (iri: string) => computed(() => store[iri]) },
    resourcesManager: { send, errors, removeError: vi.fn(), createResource: vi.fn(), updateResource: vi.fn(), deleteResource: vi.fn() },
  }))
  return { send, fetch, fetchResource }
}

describe('the fixture extension\'s orders admin, built only from the public building blocks (#487)', () => {
  beforeEach(() => {
    mocks.route.name = '_cwa-fixture-orders'
    mocks.route.params = {}
    mocks.route.query = {}
    mocks.confirm.mockResolvedValue(true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('lists its orders with their state and money total, each linking to the order dialog route', async () => {
    const { fetch } = cwa(paid)
    const wrapper = mount(Orders, { attachTo: document.body })
    await flushPromises()

    expect(fetch).toHaveBeenCalledWith({ path: '/fixture/orders', noQuery: true })
    expect(wrapper.text()).toContain('SBP-1')
    expect(wrapper.text()).toContain('paid')
    expect(wrapper.text()).toContain('£12.99')
    expect(wrapper.findComponent({ name: 'NuxtLink' }).props('to')).toMatchObject({ name: '_cwa-fixture-orders-iri', params: { iri: ORDER } })
  })

  test('the order dialog shows the order read-only and refunds a paid order after a confirm, then reloads it', async () => {
    mocks.route.name = '_cwa-fixture-orders-iri'
    mocks.route.params = { iri: ORDER }
    const { send, fetchResource } = cwa(paid)
    const wrapper = mount(Order, { attachTo: document.body })
    await flushPromises()

    expect(document.body.textContent).toContain('reader@example.com')
    expect(document.body.textContent).toContain('A book')
    const loads = fetchResource.mock.calls.length
    ;(document.querySelector('[data-testid="fixture-order-refund"]') as HTMLElement).click()
    await flushPromises()

    expect(mocks.confirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'Refund this order?' }))
    expect(send).toHaveBeenCalledWith(`${ORDER}/refund`, 'POST', undefined)
    expect(mocks.toast).toHaveBeenCalledWith({ tone: 'success', title: 'Order refunded' })
    expect(fetchResource.mock.calls.length).toBeGreaterThan(loads)
    expect(wrapper.emitted('reload')).toBeTruthy()
  })

  test('offers no refund for an order that is not paid', async () => {
    mocks.route.name = '_cwa-fixture-orders-iri'
    mocks.route.params = { iri: ORDER }
    cwa({ ...paid, state: 'refunded' })
    mount(Order, { attachTo: document.body })
    await flushPromises()

    expect(document.body.textContent).toContain('reader@example.com')
    expect(document.querySelector('[data-testid="fixture-order-refund"]')).toBeNull()
  })
})
