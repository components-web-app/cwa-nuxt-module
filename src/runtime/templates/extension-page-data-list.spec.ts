// @vitest-environment nuxt
import { afterEach, describe, expect, test, vi } from 'vitest'
import { defineComponent, h, provide } from 'vue'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import ExtensionPageDataList from './extension-page-data-list.vue'
import { areaHeadingKey } from '#cwa/templates/components/core/ui/field-keys'

enableAutoUnmount(afterEach)

const mocks = vi.hoisted(() => ({ route: null as any, docs: null as any }))

vi.mock('vue-router', async () => {
  const { reactive } = await import('vue')
  mocks.route = reactive({
    name: '_cwa-ecommerce-products-type',
    params: { type: 'bookPageData' } as Record<string, string>,
    query: {},
    meta: { cwaPageDataList: '_cwa-ecommerce-products' },
  })
  const mod = await vi.importActual<typeof import('vue-router')>('vue-router')
  return { ...mod, useRoute: () => mocks.route, useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }
})

vi.mock('#cwa/composables/cwa', async () => {
  const { ref } = await import('vue')
  return {
    useCwa: () => ({
      fetch: vi.fn(() => ({ response: Promise.resolve({ _data: { member: [], totalItems: 0 } }) })),
      resources: { getResource: () => ref(null) },
      getApiDocumentation: async () => mocks.docs,
      pageDataConfig: { BookPageData: { name: 'Books' } },
    }),
  }
})

vi.mock('#build/cwa-extension-page-data', () => ({
  extensionPageDataLists: { '_cwa-ecommerce-products': { label: 'Products', property: 'variants', columns: [] } },
}))

mockNuxtImport('useHead', () => vi.fn())

function docsWith(types: string[]) {
  return {
    entrypoint: Object.fromEntries(types.map(type => [type.charAt(0).toLowerCase() + type.slice(1), `/page_data/${type.toLowerCase()}s`])),
    docs: { supportedClass: types.map(title => ({ title, supportedProperty: [{ title: 'title' }, { title: 'variants' }] })) },
    pageDataMetadata: { member: types.map(type => ({ resourceClass: `App\\Entity\\${type}` })) },
  }
}

const LinkStub = defineComponent({
  props: { to: { type: [Object, String], required: true } },
  setup(props, { slots, attrs }) {
    return () => h('a', { ...attrs, 'href': '#', 'data-to': JSON.stringify(props.to) }, slots.default?.())
  },
})

const InArea = defineComponent({
  setup() {
    provide(areaHeadingKey, true)
    return () => [h('h1', 'E-commerce'), h(ExtensionPageDataList)]
  },
})

async function mountInArea(types: string[]) {
  mocks.docs = docsWith(types)
  mount(InArea, { attachTo: document.body, global: { stubs: { NuxtLink: LinkStub } } })
  await flushPromises()
}

function backLink() {
  return document.querySelector<HTMLAnchorElement>('[data-testid="list-back"]')
}

describe('an extension page-data list of one type', () => {
  test('with several matching types, links back to the area\'s type list by the list\'s label, above the list', async () => {
    await mountInArea(['BookPageData', 'MusicPageData'])

    const link = backLink()!
    expect(link.textContent?.trim()).toBe('Products')
    expect(JSON.parse(link.dataset.to!)).toEqual({ name: '_cwa-ecommerce-products' })
    const toolbar = document.querySelector('[data-testid="list-toolbar"]')!
    expect(link.compareDocumentPosition(toolbar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  test('with exactly one matching type there is no back link, since the type list would send you straight back', async () => {
    await mountInArea(['BookPageData'])

    expect(document.querySelector('[data-testid="list-toolbar"]')).not.toBeNull()
    expect(backLink()).toBeNull()
  })

  test('keeps the area\'s single h1, and the back link is not a heading', async () => {
    await mountInArea(['BookPageData', 'MusicPageData'])

    expect([...document.querySelectorAll('h1')].map(heading => heading.textContent)).toEqual(['E-commerce'])
    expect(backLink()!.closest('h1, h2, h3, h4, h5, h6, [role="heading"]')).toBeNull()
  })
})
