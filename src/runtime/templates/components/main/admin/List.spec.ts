// @vitest-environment nuxt
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref } from 'vue'
import { mount, flushPromises, enableAutoUnmount } from '@vue/test-utils'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import List from './List.vue'
import { axe } from '../../../../../../test/utils/axe'

enableAutoUnmount(afterEach)

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
  head: vi.fn(),
  route: null as any,
}))

vi.mock('vue-router', async () => {
  const { reactive } = await import('vue')
  mocks.route = reactive({ name: '_cwa-ecommerce-orders', params: {} as Record<string, string>, query: {} as Record<string, any> })
  const mod = await vi.importActual<typeof import('vue-router')>('vue-router')
  return { ...mod, useRoute: () => mocks.route, useRouter: () => ({ push: mocks.push, replace: mocks.replace }) }
})

vi.mock('#cwa/composables/cwa', () => ({
  useCwa: () => ({
    fetch: mocks.fetch,
    resources: { getResource: () => ref(null) },
  }),
}))

mockNuxtImport('useHead', () => mocks.head)

const orders = [
  { '@id': '/_ecommerce/orders/1', 'number': 'ORD-1' },
  { '@id': '/_ecommerce/orders/2', 'number': 'ORD-2' },
]

function respondWith(member: Record<string, unknown>[]) {
  mocks.fetch.mockImplementation(() => ({ response: Promise.resolve({ _data: { member, totalItems: member.length } }) }))
}

const itemSlot = `<template #item="{ data, link }"><div role="row" class="order-row" :data-link="JSON.stringify(link)"><span role="cell">{{ data.number }}</span></div></template>`

function mountList(props: Record<string, unknown> = {}, slots: Record<string, string> = {}) {
  return mount(List, {
    props: {
      title: 'Orders',
      fetchUrl: '/_ecommerce/orders',
      noun: 'orders',
      columns: [{ label: 'Order' }],
      orderOptions: [{ label: 'Newest first', value: { createdAt: 'desc' } }],
      searchLabel: 'Search orders',
      ...props,
    },
    slots: { item: itemSlot, ...slots },
    attachTo: document.body,
  })
}

describe('CwaAdminList', () => {
  beforeEach(() => {
    mocks.route.query = {}
    mocks.route.params = {}
    respondWith(orders)
  })

  afterEach(() => {
    mocks.fetch.mockReset()
  })

  test('an extension list loads its own collection, with the page query, when it mounts', async () => {
    mocks.route.query = { status: 'paid' }
    mountList()
    await flushPromises()
    expect(mocks.fetch).toHaveBeenCalledWith({ path: '/_ecommerce/orders?status=paid', noQuery: true })
  })

  test('each item renders through the extension\'s slot with a link to the list\'s own item dialog route', async () => {
    const wrapper = mountList()
    await flushPromises()
    const rows = wrapper.findAll('.order-row')
    expect(rows.map(row => row.text())).toEqual(['ORD-1', 'ORD-2'])
    expect(JSON.parse(rows[1]!.attributes('data-link')!)).toEqual({ name: '_cwa-ecommerce-orders-iri', params: { iri: '/_ecommerce/orders/2' }, query: {} })
  })

  test('the count names the total, singular from createNoun when there is one item', async () => {
    const wrapper = mountList({ createNoun: 'order' })
    await flushPromises()
    expect(wrapper.get('[data-testid="list-count"]').text()).toBe('2 orders')

    respondWith(orders.slice(0, 1))
    await (wrapper.vm as unknown as { reload: () => Promise<void> }).reload()
    await flushPromises()
    expect(wrapper.get('[data-testid="list-count"]').text()).toBe('1 order')
  })

  test('Create in the toolbar and in the empty state goes to the add dialog, only when createNoun is given', async () => {
    respondWith([])
    const withoutCreate = mountList()
    await flushPromises()
    expect(withoutCreate.find('[data-testid="list-create"]').exists()).toBe(false)
    expect(withoutCreate.find('[data-testid="list-empty-create"]').exists()).toBe(false)
    withoutCreate.unmount()

    const wrapper = mountList({ createNoun: 'order' })
    await flushPromises()
    await wrapper.get('[data-testid="list-create"]').trigger('click')
    await wrapper.get('[data-testid="list-empty-create"]').trigger('click')
    expect(mocks.push).toHaveBeenCalledTimes(2)
    expect(mocks.push).toHaveBeenNthCalledWith(1, { name: '_cwa-ecommerce-orders-iri', params: { iri: 'add' }, query: {} })
    expect(mocks.push).toHaveBeenNthCalledWith(2, { name: '_cwa-ecommerce-orders-iri', params: { iri: 'add' }, query: {} })
  })

  test('an empty slot replaces the default Create button in the empty state', async () => {
    respondWith([])
    const wrapper = mountList({ createNoun: 'order' }, { empty: '<p data-testid="own-empty">Import orders</p>' })
    await flushPromises()
    expect(wrapper.find('[data-testid="own-empty"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="list-empty-create"]').exists()).toBe(false)
  })

  test('the extension\'s filters and notice render in the toolbar and above the list', async () => {
    const wrapper = mountList({}, {
      filters: '<button type="button" data-testid="own-filter">Paid only</button>',
      notice: '<p data-testid="own-notice">Orders sync hourly.</p>',
    })
    await flushPromises()
    expect(wrapper.get('[data-testid="list-toolbar"]').find('[data-testid="own-filter"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="list-content"]').find('[data-testid="own-notice"]').exists()).toBe(true)
  })

  test('reload fetches the list again, so a page can refresh it after its own action', async () => {
    const wrapper = mountList()
    await flushPromises()
    expect(mocks.fetch).toHaveBeenCalledTimes(1)
    await (wrapper.vm as unknown as { reload: () => Promise<void> }).reload()
    expect(mocks.fetch).toHaveBeenCalledTimes(2)
    expect((wrapper.vm as unknown as { total: number }).total).toBe(2)
  })

  test('the page title is the list title', () => {
    mountList()
    expect(mocks.head).toHaveBeenCalledTimes(1)
    expect(mocks.head.mock.calls[0]![0].title()).toBe('Orders')
  })

  test('has no axe violations with rows and with an empty list', async () => {
    const wrapper = mountList({ createNoun: 'order' }, { filters: '<button type="button">Paid only</button>' })
    await flushPromises()
    expect(wrapper.findAll('.order-row')).toHaveLength(2)
    expect(await axe(document.body)).toHaveNoViolations()
    wrapper.unmount()

    respondWith([])
    const empty = mountList({ createNoun: 'order' })
    await flushPromises()
    expect(empty.find('[data-testid="list-empty-create"]').exists()).toBe(true)
    expect(await axe(document.body)).toHaveNoViolations()
  })
})
