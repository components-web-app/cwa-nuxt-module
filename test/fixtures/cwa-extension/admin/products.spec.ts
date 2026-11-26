// @vitest-environment nuxt
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { computed, defineComponent, h } from 'vue'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import * as cwaComposable from '#cwa/composables/cwa'
import ExtensionArea from '#cwa/templates/extension-area.vue'
import ProductsList from '#cwa/templates/extension-page-data-list.vue'
import ProductItem from '#cwa/templates/extension-page-data-item.vue'
import PageResourceAdminModal from '#cwa/templates/components/core/admin/PageResourceAdminModal.vue'
import Orders from './orders.vue'

enableAutoUnmount(afterEach)

const mocks = vi.hoisted(() => ({ route: null as any }))

vi.mock('vue-router', async (importOriginal) => {
  const { reactive } = await import('vue')
  mocks.route = reactive({ name: '_cwa-fixture-products', params: {} as Record<string, string>, query: {} as Record<string, unknown>, hash: '', matched: [] as { name?: string }[] })
  const mod = await importOriginal<typeof import('vue-router')>()
  return { ...mod, useRoute: () => mocks.route, useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }
})

const docs = {
  entrypoint: { bookPageData: '/page_data/book_page_datas', musicPageData: '/page_data/music_page_datas', blogArticleData: '/page_data/blog_article_datas' },
  docs: {
    supportedClass: [
      { title: 'BookPageData', supportedProperty: [{ title: 'title' }, { title: 'variants' }] },
      { title: 'MusicPageData', supportedProperty: [{ title: 'title' }, { title: 'variants' }] },
      { title: 'BlogArticleData', supportedProperty: [{ title: 'title' }, { title: 'htmlContent' }] },
    ],
  },
  pageDataMetadata: {
    member: ['AbstractPageData', 'BookPageData', 'MusicPageData', 'BlogArticleData'].map(name => ({ resourceClass: `App\\Entity\\${name}` })),
  },
}

const dune = { '@id': '/page_data/book_page_datas/dune', '@type': 'BookPageData', 'title': 'Dune', 'variants': [{ format: 'Hardback', price: 2000 }, { format: 'Paperback', price: 999 }] }
const abbey = { '@id': '/page_data/music_page_datas/abbey', '@type': 'MusicPageData', 'title': 'Abbey Road', 'variants': [{ format: 'Vinyl', price: 2499 }] }
const members: Record<string, Record<string, unknown>[]> = {
  '/page_data/book_page_datas': [dune],
  '/page_data/music_page_datas': [abbey],
}

function cwa(store: Record<string, any> = {}) {
  const fetch = vi.fn(({ path }: { path: string }) => {
    const member = members[path.split('?')[0]!] ?? []
    return { response: Promise.resolve({ _data: { member, totalItems: member.length } }) }
  })
  vi.spyOn(cwaComposable, 'useCwa').mockImplementation(() => ({
    fetch,
    getApiDocumentation: vi.fn(async () => docs),
    pageDataConfig: { MusicPageData: { name: 'Albums' } },
    auth: { hasRole: (role: string) => role === 'ROLE_ADMIN' },
    resources: { getResource: (iri: string) => computed(() => store[iri]) },
  }) as unknown as ReturnType<typeof cwaComposable.useCwa>)
  return { fetch }
}

function rowTitles() {
  return [...document.querySelectorAll('[data-testid="list-row-link"]')].map(link => link.textContent?.trim())
}

describe('the fixture extension\'s page-data list of products', () => {
  beforeEach(() => {
    mocks.route.name = '_cwa-fixture-products'
    mocks.route.params = {}
    mocks.route.query = {}
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('requests the page data of every type whose API docs list the property, and only those', async () => {
    const { fetch } = cwa()
    mount(ProductsList, { attachTo: document.body })
    await flushPromises()

    expect(fetch.mock.calls.map(([event]) => event.path).sort()).toEqual(['/page_data/book_page_datas', '/page_data/music_page_datas'])
    expect(rowTitles().sort()).toEqual(['Abbey Road', 'Dune'])
  })

  test('merges the types into one list sorted by the chosen order, counted together', async () => {
    mocks.route.query = { 'order[title]': 'asc' }
    cwa()
    mount(ProductsList, { attachTo: document.body })
    await flushPromises()

    expect(rowTitles()).toEqual(['Abbey Road', 'Dune'])
    expect(document.querySelector('[data-testid="list-announcer"]')!.textContent).toBe('2 products')
  })

  test('pages each type on its own, so the pages run to the largest type\'s count while the count is every type\'s', async () => {
    const { fetch } = cwa()
    fetch.mockImplementation(({ path }: { path: string }) => {
      const member = members[path.split('?')[0]!] ?? []
      return { response: Promise.resolve({ _data: { member, totalItems: path.startsWith('/page_data/book_page_datas') ? 45 : 30 } }) }
    })
    const wrapper = mount(ProductsList, { attachTo: document.body })
    await flushPromises()

    expect(wrapper.findComponent({ name: 'Pagination' }).props('total')).toBe(45)
    expect(document.querySelector('[data-testid="list-announcer"]')!.textContent).toBe('75 products')
  })

  test('each row links to that item\'s page-data dialog in the list, and names its type', async () => {
    cwa()
    const wrapper = mount(ProductsList, { attachTo: document.body })
    await flushPromises()

    const links = wrapper.findAllComponents({ name: 'NuxtLink' }).map(link => link.props('to'))
    expect(links).toContainEqual(expect.objectContaining({ name: '_cwa-fixture-products-iri', params: { iri: dune['@id'] } }))
    expect(document.body.textContent).toContain('Albums')
  })

  test('the row\'s link opens the page-data dialog for that item, as its type', async () => {
    mocks.route.name = '_cwa-fixture-products-iri'
    mocks.route.params = { iri: dune['@id'] }
    cwa({ [dune['@id']]: { data: dune } })
    const wrapper = mount(ProductItem, { global: { stubs: { PageResourceAdminModal: true } } })

    expect(wrapper.findComponent(PageResourceAdminModal).props('resourceType')).toBe('BookPageData')
  })

  test('its From column is the extension\'s component, given the row\'s data', async () => {
    cwa()
    mount(ProductsList, { attachTo: document.body })
    await flushPromises()

    expect([...document.querySelectorAll('[data-testid="fixture-from-price"]')].map(cell => cell.textContent).sort()).toEqual(['£24.99', '£9.99'])
  })
})

describe('the fixture extension\'s area', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test.each([
    ['orders list', '_cwa-fixture-orders', Orders],
    ['page-data list of products', '_cwa-fixture-products', ProductsList],
  ])('its %s has the area\'s heading as the page\'s only h1', async (_, name, page) => {
    mocks.route.name = name
    mocks.route.matched = [{ name: '_cwa-fixture' }, { name }]
    cwa()
    mount(ExtensionArea, {
      attachTo: document.body,
      global: { stubs: { NuxtPage: defineComponent({ setup: () => () => h(page) }) } },
    })
    await flushPromises()

    expect([...document.querySelectorAll('h1')].map(heading => heading.textContent?.trim())).toEqual(['Fixture shop'])
  })
})
