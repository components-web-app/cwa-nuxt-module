// @vitest-environment nuxt
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { computed, defineComponent, h, reactive, ref } from 'vue'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import * as cwaComposable from '#cwa/composables/cwa'
import ExtensionArea from '#cwa/templates/extension-area.vue'
import ProductTypes from '#cwa/templates/extension-page-data-types.vue'
import ProductsList from '#cwa/templates/extension-page-data-list.vue'
import ProductItem from '#cwa/templates/extension-page-data-item.vue'
import PageResourceAdminModal from '#cwa/templates/components/core/admin/PageResourceAdminModal.vue'
import Orders from './orders.vue'

enableAutoUnmount(afterEach)

const mocks = vi.hoisted(() => ({ route: null as any, replace: vi.fn() }))

vi.mock('vue-router', async (importOriginal) => {
  const { reactive } = await import('vue')
  mocks.route = reactive({ name: '', params: {} as Record<string, string>, query: {} as Record<string, unknown>, hash: '', meta: {} as Record<string, unknown>, matched: [] as { name?: string }[] })
  const mod = await importOriginal<typeof import('vue-router')>()
  return { ...mod, useRoute: () => mocks.route, useRouter: () => ({ push: vi.fn(), replace: mocks.replace }) }
})

const LIST = '_cwa-fixture-products'

function docsWith(withVariants: string[]) {
  const types = ['BookPageData', 'MusicPageData', 'BlogArticleData']
  return {
    entrypoint: { bookPageData: '/page_data/book_page_datas', musicPageData: '/page_data/music_page_datas', blogArticleData: '/page_data/blog_article_datas' },
    docs: {
      supportedClass: types.map(title => ({ title, supportedProperty: [{ title: 'title' }, ...(withVariants.includes(title) ? [{ title: 'variants' }] : [])] })),
    },
    pageDataMetadata: {
      member: ['AbstractPageData', ...types].map(name => ({ resourceClass: `App\\Entity\\${name}` })),
    },
  }
}

const dune = { '@id': '/page_data/book_page_datas/dune', '@type': 'BookPageData', 'title': 'Dune', 'page': '/_/pages/template', 'variants': [{ format: 'Hardback', price: 2000 }, { format: 'Paperback', price: 999 }] }
const members: Record<string, Record<string, unknown>[]> = {
  '/page_data/book_page_datas': [dune],
}

function cwa({ withVariants = ['BookPageData', 'MusicPageData'], roles = ['ROLE_ADMIN'] }: { withVariants?: string[], roles?: string[] } = {}) {
  const store = reactive<Record<string, any>>({})
  const fetch = vi.fn(({ path }: { path: string }) => {
    const member = members[path.split('?')[0]!] ?? []
    return { response: Promise.resolve({ _data: { member, totalItems: member.length } }) }
  })
  vi.spyOn(cwaComposable, 'useCwa').mockImplementation(() => ({
    fetch,
    fetchResource: vi.fn(async ({ path }: { path: string }) => {
      if (path === dune['@id']) {
        store[path] = { data: dune, apiState: { status: 'SUCCESS' } }
        return dune
      }
    }),
    getApiDocumentation: vi.fn(async () => docsWith(withVariants)),
    pageDataConfig: { BookPageData: { name: 'Books' }, MusicPageData: { name: 'Albums' } },
    auth: { hasRole: (role: string) => roles.includes(role) },
    resources: { displayPageIri: ref(undefined), getResource: (iri: string) => computed(() => store[iri]) },
    resourcesManager: { errors: reactive([]), removeError: vi.fn(), addError: vi.fn() },
    admin: { toggleEdit: vi.fn() },
  }) as unknown as ReturnType<typeof cwaComposable.useCwa>)
  return { fetch }
}

function at(name: string, params: Record<string, string> = {}) {
  mocks.route.name = name
  mocks.route.params = params
  mocks.route.meta = { cwaPageDataList: LIST }
}

function rowLinks() {
  return [...document.querySelectorAll('[data-testid="list-row-link"]')].map(link => link.textContent?.trim())
}

beforeEach(() => {
  mocks.route.query = {}
  mocks.route.hash = ''
  mocks.route.matched = []
})

afterEach(() => {
  mocks.replace.mockReset()
  vi.restoreAllMocks()
})

describe('the fixture extension\'s page-data list of products', () => {
  test('with several types whose API docs list the property, its tab lists those types, each opening its own list in the area', async () => {
    at(LIST)
    const { fetch } = cwa()
    const wrapper = mount(ProductTypes, { attachTo: document.body })
    await flushPromises()

    expect(rowLinks()).toEqual(['Books', 'Albums'])
    expect(wrapper.findAllComponents({ name: 'NuxtLink' }).map(link => link.props('to'))).toEqual([
      { name: `${LIST}-type`, params: { type: 'bookPageData' } },
      { name: `${LIST}-type`, params: { type: 'musicPageData' } },
    ])
    expect(fetch).not.toHaveBeenCalled()
    expect(mocks.replace).not.toHaveBeenCalled()
  })

  test('with exactly one such type, its tab goes straight to that type\'s list', async () => {
    at(LIST)
    mocks.route.query = { search: 'dune' }
    cwa({ withVariants: ['BookPageData'] })
    mount(ProductTypes, { attachTo: document.body })
    await flushPromises()

    expect(mocks.replace).toHaveBeenCalledWith({ name: `${LIST}-type`, params: { type: 'bookPageData' }, query: { search: 'dune' } })
    expect(rowLinks()).toEqual([])
  })

  test('a chosen type is listed with one request for that type alone, titled by its name', async () => {
    at(`${LIST}-type`, { type: 'bookPageData' })
    const { fetch } = cwa()
    mount(ProductsList, { attachTo: document.body })
    await flushPromises()

    expect(fetch.mock.calls.map(([event]) => event.path)).toEqual(['/page_data/book_page_datas'])
    expect(rowLinks()).toEqual(['Dune'])
    expect(document.querySelector('[data-testid="list-table"]')!.getAttribute('aria-label')).toBe('Books')
  })

  test('a type whose API docs do not list the property is not listed, even by its URL', async () => {
    at(`${LIST}-type`, { type: 'blogArticleData' })
    const { fetch } = cwa()
    mount(ProductsList, { attachTo: document.body })
    await flushPromises()

    expect(fetch).not.toHaveBeenCalled()
  })

  test('each row links to that item\'s page-data dialog within the area', async () => {
    at(`${LIST}-type`, { type: 'bookPageData' })
    cwa()
    const wrapper = mount(ProductsList, { attachTo: document.body })
    await flushPromises()

    expect(wrapper.findAllComponents({ name: 'NuxtLink' }).map(link => link.props('to'))).toContainEqual(expect.objectContaining({ name: `${LIST}-type-iri`, params: { iri: dune['@id'] } }))
  })

  test('its From column is the extension\'s component, given the row\'s data', async () => {
    at(`${LIST}-type`, { type: 'bookPageData' })
    cwa()
    mount(ProductsList, { attachTo: document.body })
    await flushPromises()

    expect([...document.querySelectorAll('[data-testid="fixture-from-price"]')].map(cell => cell.textContent)).toEqual(['£9.99'])
  })

  test('the row\'s link opens the page-data dialog for that item, as the type in its URL', () => {
    at(`${LIST}-type-iri`, { type: 'bookPageData', iri: dune['@id'] })
    cwa()
    const wrapper = mount(ProductItem, { global: { stubs: { PageResourceAdminModal: true } } })

    expect(wrapper.findComponent(PageResourceAdminModal).props('resourceType')).toBe('BookPageData')
  })
})

describe('the fixture extension\'s page-data tab', () => {
  test('declared without a role, it shows for a content admin who has only ROLE_CMS_ADMIN, and is given the page data', async () => {
    at('_cwa-data-type-iri', { type: 'bookPageData', iri: dune['@id'] })
    cwa({ roles: ['ROLE_CMS_ADMIN'] })
    mount(PageResourceAdminModal, { props: { resourceType: 'BookPageData' }, attachTo: document.body })
    await flushPromises()

    const tab = [...document.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find(found => found.textContent?.trim() === 'Formats and prices')!
    expect(tab).toBeDefined()
    tab.click()
    await vi.waitFor(() => expect(document.querySelector('[data-tab="formats"]')!.textContent).toContain('Paperback'))
  })
})

describe('the fixture extension\'s area', () => {
  test.each([
    ['orders list', '_cwa-fixture-orders', {}, Orders],
    ['product types', LIST, {}, ProductTypes],
    ['list of one product type', `${LIST}-type`, { type: 'bookPageData' }, ProductsList],
  ])('its %s has the area\'s heading as the page\'s only h1', async (_, name, params, page) => {
    at(name, params)
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
