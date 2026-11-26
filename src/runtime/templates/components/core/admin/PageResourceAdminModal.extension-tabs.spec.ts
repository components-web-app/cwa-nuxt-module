// @vitest-environment nuxt
import { afterEach, describe, expect, test, vi } from 'vitest'
import { computed, reactive, ref } from 'vue'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import PageResourceAdminModal from './PageResourceAdminModal.vue'
import CwaUiDialog from '#cwa/templates/components/ui/Dialog.vue'
import * as cwaComposable from '#cwa/composables/cwa'

const mocks = vi.hoisted(() => ({
  route: undefined as unknown as { name: string, params: Record<string, string>, query: Record<string, string>, hash: string },
  confirm: vi.fn(),
  ownSave: vi.fn(),
  received: [] as { iri: unknown, data: unknown }[],
}))

vi.mock('vue-router', async (importOriginal) => {
  const mod = await importOriginal<typeof import('vue-router')>()
  const { reactive } = await import('vue')
  mocks.route = reactive({ name: '_cwa-data-type-iri', params: { iri: 'add' }, query: {}, hash: '' })
  return { ...mod, useRoute: () => mocks.route, useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }
})
vi.mock('#cwa/composables/cwa-confirm', () => ({ useCwaConfirm: () => mocks.confirm }))
vi.mock('#cwa/resources/realtime-view', () => ({
  realtimeView: () => ({ load: async () => ({ peers: () => [] }) }),
}))
vi.mock('#build/cwa-extension-page-data', async () => {
  const { defineComponent, h } = await import('vue')
  const { default: CwaUiInput } = await import('#cwa/templates/components/ui/Input.vue')
  const Formats = defineComponent({
    props: { iri: { type: String, default: undefined }, data: { type: Object, default: undefined } },
    setup(props) {
      return () => {
        mocks.received.push({ iri: props.iri, data: props.data })
        return h('div', { 'data-testid': 'formats-tab' }, [
          h('p', { 'data-testid': 'formats-count' }, `${(props.data?.variants ?? []).length} formats`),
          h('button', { 'data-testid': 'formats-save', 'onClick': () => mocks.ownSave(props.iri) }, 'Add format'),
          h(CwaUiInput, { field: 'title', label: 'Format name' }),
        ])
      }
    },
  })
  return {
    extensionPageDataTabs: [
      { key: 'formats', label: 'Formats and prices', role: 'ROLE_ADMIN', property: 'variants', component: Formats },
      { key: 'stock', label: 'Stock', role: 'ROLE_STOCK', property: 'variants', component: defineComponent({ setup: () => () => h('p', 'Stock') }) },
    ],
    extensionPageDataLists: {},
  }
})

enableAutoUnmount(afterEach)
afterEach(() => {
  mocks.confirm.mockReset()
  mocks.ownSave.mockReset()
  mocks.received.length = 0
  vi.restoreAllMocks()
  Object.assign(mocks.route, { params: { iri: 'add' }, hash: '' })
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
  pageDataMetadata: { member: [] },
}

function setup({ iri, type, data = {}, roles = ['ROLE_ADMIN'], pageDataConfig = {}, hash = '' }: {
  iri: string
  type: string
  data?: Record<string, unknown>
  roles?: string[]
  pageDataConfig?: Record<string, unknown>
  hash?: string
}) {
  const resource = { '@id': iri, '@type': type, 'title': 'Dune', 'page': '/_/pages/template', ...data }
  const store = reactive<Record<string, any>>({})
  vi.spyOn(cwaComposable, 'useCwa').mockImplementation(() => ({
    resources: {
      displayPageIri: ref(undefined),
      getResource: (path: string) => computed(() => store[path]),
    },
    resourcesManager: { errors: reactive([]), removeError: vi.fn(), addError: vi.fn(), createResource: vi.fn() },
    auth: { hasRole: (role: string) => roles.includes(role) },
    fetch: vi.fn(() => ({ response: Promise.resolve({ _data: { member: [] } }) })),
    fetchResource: vi.fn(async ({ path }: { path: string }) => {
      if (path === iri) {
        store[path] = { data: resource, apiState: { status: 'SUCCESS' } }
        return resource
      }
    }),
    getApiDocumentation: vi.fn(async () => docs),
    pageDataConfig,
    admin: { toggleEdit: vi.fn() },
  }) as unknown as ReturnType<typeof cwaComposable.useCwa>)
  Object.assign(mocks.route, { params: { iri }, hash })
  const wrapper = mount(PageResourceAdminModal, { props: { resourceType: iri === 'add' ? type : undefined }, attachTo: document.body })
  return { wrapper, store }
}

function tabNames() {
  return [...document.querySelectorAll<HTMLButtonElement>('[role="tab"]')].map(found => found.textContent?.trim().replace(/\s+/g, ' '))
}

function tab(name: string) {
  return [...document.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find(found => found.textContent?.trim() === name)!
}

const BOOK = '/page_data/book_page_datas/dune'

describe('an extension\'s page-data tabs in the page-data dialog', () => {
  test('a type whose API docs list the property gets the tab, though its loaded data has no such key', async () => {
    setup({ iri: BOOK, type: 'BookPageData' })
    await flushPromises()

    expect(tabNames()).toContain('Formats and prices')
  })

  test('a type whose API docs do not list the property gets no tab, though its loaded data has that key', async () => {
    setup({ iri: '/page_data/blog_article_datas/one', type: 'BlogArticleData', data: { variants: [{ format: 'Hardback' }] } })
    await flushPromises()

    expect(tabNames()).toEqual(['Details', 'Routes', 'Info'])
  })

  test('sits after Details and before Routes, in declared order', async () => {
    setup({ iri: BOOK, type: 'BookPageData', roles: ['ROLE_ADMIN', 'ROLE_STOCK'] })
    await flushPromises()

    expect(tabNames()).toEqual(['Details', 'Formats and prices', 'Stock', 'Routes', 'Info'])
  })

  test('is hidden from a user without its role', async () => {
    setup({ iri: BOOK, type: 'BookPageData', roles: ['ROLE_ADMIN'] })
    await flushPromises()

    expect(tabNames()).toEqual(['Details', 'Formats and prices', 'Routes', 'Info'])
  })

  test('is hidden while the page data is being added', async () => {
    setup({ iri: 'add', type: 'BookPageData', roles: ['ROLE_ADMIN', 'ROLE_STOCK'] })
    await flushPromises()

    expect(tabNames()).toEqual(['Details', 'Routes'])
  })

  test('its hash opens it once the docs say the type has it', async () => {
    setup({ iri: BOOK, type: 'BookPageData', hash: '#formats' })
    await flushPromises()

    expect(tab('Formats and prices').getAttribute('aria-selected')).toBe('true')
    expect(document.querySelector('[data-testid="formats-tab"]')).not.toBeNull()
  })

  test('the app switching it off for one type hides it for that type only', async () => {
    const { wrapper } = setup({ iri: BOOK, type: 'BookPageData', pageDataConfig: { BookPageData: { hideExtensionTabs: ['formats'] } } })
    await flushPromises()
    expect(tabNames()).toEqual(['Details', 'Routes', 'Info'])
    wrapper.unmount()

    setup({ iri: '/page_data/music_page_datas/one', type: 'MusicPageData', pageDataConfig: { BookPageData: { hideExtensionTabs: ['formats'] } } })
    await flushPromises()
    expect(tabNames()).toEqual(['Details', 'Formats and prices', 'Routes', 'Info'])
  })

  test('its component is given the page data\'s IRI and its loaded data, and sees the data change', async () => {
    const { store } = setup({ iri: BOOK, type: 'BookPageData', data: { variants: [{ format: 'Hardback' }] } })
    await flushPromises()
    tab('Formats and prices').click()
    await flushPromises()

    expect(mocks.received.at(-1)).toEqual({ iri: BOOK, data: expect.objectContaining({ '@id': BOOK, 'title': 'Dune', 'variants': [{ format: 'Hardback' }] }) })
    expect(document.querySelector('[data-testid="formats-count"]')!.textContent).toBe('1 formats')

    store[BOOK] = { ...store[BOOK], data: { ...store[BOOK].data, variants: [{ format: 'Hardback' }, { format: 'Paperback' }] } }
    await flushPromises()
    expect(document.querySelector('[data-testid="formats-count"]')!.textContent).toBe('2 formats')
  })

  test('what it saves through its own API never changes the dialog\'s Save count or unsaved state', async () => {
    vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({ matches: query.includes('reduce'), media: query }) as unknown as MediaQueryList)
    const { wrapper, store } = setup({ iri: BOOK, type: 'BookPageData', data: { variants: [] } })
    mocks.ownSave.mockImplementation((iri: string) => {
      store[iri] = { ...store[iri], data: { ...store[iri].data, variants: [{ format: 'Paperback' }] } }
    })
    await flushPromises()
    tab('Formats and prices').click()
    await flushPromises()

    document.querySelector<HTMLButtonElement>('[data-testid="formats-save"]')!.click()
    await flushPromises()

    expect(document.querySelector('[data-testid="formats-count"]')!.textContent).toBe('1 formats')
    expect(wrapper.findComponent(CwaUiDialog).props('form')!.unsavedFields).toEqual([])
    document.querySelector<HTMLButtonElement>('[data-testid="dialog-close"]')!.click()
    await flushPromises()
    expect(mocks.confirm).not.toHaveBeenCalled()
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  test('a kit field in it never joins the dialog\'s form, so typing there leaves the Save count alone', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const { wrapper } = setup({ iri: BOOK, type: 'BookPageData' })
    await flushPromises()
    tab('Formats and prices').click()
    await flushPromises()
    const input = document.querySelector<HTMLInputElement>('[data-testid="formats-tab"] input')!
    input.value = 'Hardback'
    input.dispatchEvent(new Event('input'))
    await flushPromises()

    expect(wrapper.findComponent(CwaUiDialog).props('form')!.unsavedFields).toEqual([])
  })
})
