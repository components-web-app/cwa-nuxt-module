// @vitest-environment nuxt
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { mount } from '@vue/test-utils'
import PageAdminModal from './PageAdminModal.vue'
import * as cwaComposable from '#cwa/composables/cwa'

const { mockUseItemPage, mockUseParentPageLoader } = vi.hoisted(() => ({
  mockUseItemPage: vi.fn(),
  mockUseParentPageLoader: vi.fn(),
}))

vi.mock('#cwa-layer/pages/_cwa/index/composables/useItemPage', () => ({
  useItemPage: mockUseItemPage,
}))
vi.mock('#cwa-layer/pages/_cwa/index/composables/useParentPageLoader', () => ({
  useParentPageLoader: mockUseParentPageLoader,
}))

const mockLayouts = [{ '@id': '/_/layouts/default', 'reference': 'Default' }]
const mockParentPages = [
  { '@id': '/_/pages/uuid-1', 'reference': 'Home' },
  { '@id': '/_/pages/uuid-2', 'reference': 'Conference' },
]

function setup(
  localDataOverrides: Record<string, any> = {},
  getResource: (iri: string) => any = () => ref(null),
  parentPagesOverride?: any[],
) {
  const localResourceData = ref({
    '@id': '/_/pages/uuid-self',
    'reference': 'My Page',
    'isTemplate': false,
    'title': '',
    'metaDescription': '',
    'layout': '/_/layouts/default',
    'uiComponent': 'PrimaryPageTemplate',
    'uiClassNames': null,
    'parentPage': null,
    ...localDataOverrides,
  })

  mockUseItemPage.mockReturnValue({
    isAdding: ref(false),
    isLoading: ref(false),
    isUpdating: ref(false),
    localResourceData,
    resource: ref({ '@id': '/_/pages/uuid-self', '@type': 'Page', 'route': '/_/routes/uuid' }),
    formatDate: vi.fn(() => '2026-01-01'),
    deleteResource: vi.fn(),
    saveResource: vi.fn(),
    saveTitle: vi.fn(),
    loadResource: vi.fn(),
    getInternalResourceLink: vi.fn(() => ({ name: '_cwa-index-pages-iri', params: {} })),
  })

  mockUseParentPageLoader.mockReturnValue({
    parentPages: ref(parentPagesOverride ?? mockParentPages),
    loadParentPageOptions: vi.fn(),
  })

  // @ts-expect-error
  vi.spyOn(cwaComposable, 'useCwa').mockImplementation(() => ({
    pagesConfig: { PrimaryPageTemplate: { name: 'Primary Page Template' } },
    fetch: vi.fn().mockReturnValue({
      response: Promise.resolve({ _data: { member: mockLayouts } }),
    }),
    resources: { getResource: vi.fn(getResource) },
  }))

  return mount(PageAdminModal, {
    props: { iri: '/_/pages/uuid-self' },
    shallow: true,
    global: {
      stubs: {
        ResourceModalTabs: {
          props: ['tabs'],
          template: '<div><slot name="details" /><slot name="routes" /><slot name="info" /></div>',
        },
        ResourceModal: {
          template: '<div><slot /><slot name="title" /></div>',
        },
      },
    },
  })
}

describe('PageAdminModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Parent Page picker', () => {
    test('renders a "Parent Page" ModalSelect', () => {
      const wrapper = setup()
      const selects = wrapper.findAllComponents({ name: 'ModalSelect' })
      const parentSelect = selects.find(s => s.props('label') === 'Parent Page')
      expect(parentSelect?.exists()).toBe(true)
    })

    test('Parent Page options exclude the current page IRI', () => {
      const wrapper = setup()
      const selects = wrapper.findAllComponents({ name: 'ModalSelect' })
      const parentSelect = selects.find(s => s.props('label') === 'Parent Page')
      const options = parentSelect?.props('options') as Array<{ value: string }>
      expect(options.map(o => o.value)).not.toContain('/_/pages/uuid-self')
    })

    test('Parent Page options include a null "None" option and all other pages', () => {
      const wrapper = setup()
      const selects = wrapper.findAllComponents({ name: 'ModalSelect' })
      const parentSelect = selects.find(s => s.props('label') === 'Parent Page')
      const options = parentSelect?.props('options') as Array<{ label: string, value: string | null }>
      expect(options).toContainEqual({ label: 'None', value: null })
      expect(options).toContainEqual({ label: 'Conference', value: '/_/pages/uuid-2' })
    })

    test('excludes direct descendants from Parent Page options', () => {
      const wrapper = setup({}, () => ref(null), [
        { '@id': '/_/pages/uuid-1', 'reference': 'Home', 'parentPage': null },
        { '@id': '/_/pages/uuid-child', 'reference': 'Child', 'parentPage': '/_/pages/uuid-self' },
      ])
      const options = wrapper.findAllComponents({ name: 'ModalSelect' })
        .find(s => s.props('label') === 'Parent Page')
        ?.props('options') as Array<{ value: string | null }>
      expect(options.map(o => o.value)).not.toContain('/_/pages/uuid-child')
      expect(options.map(o => o.value)).toContain('/_/pages/uuid-1')
    })

    test('excludes indirect descendants (grandchildren) from Parent Page options', () => {
      const wrapper = setup({}, () => ref(null), [
        { '@id': '/_/pages/uuid-child', 'reference': 'Child', 'parentPage': '/_/pages/uuid-self' },
        { '@id': '/_/pages/uuid-grandchild', 'reference': 'Grandchild', 'parentPage': '/_/pages/uuid-child' },
      ])
      const options = wrapper.findAllComponents({ name: 'ModalSelect' })
        .find(s => s.props('label') === 'Parent Page')
        ?.props('options') as Array<{ value: string | null }>
      expect(options.map(o => o.value)).not.toContain('/_/pages/uuid-child')
      expect(options.map(o => o.value)).not.toContain('/_/pages/uuid-grandchild')
    })
  })

  describe('Page UI and Style visibility', () => {
    test('shows Page UI select when parentPage is not set', () => {
      const wrapper = setup({ parentPage: null })
      const selects = wrapper.findAllComponents({ name: 'ModalSelect' })
      const labels = selects.map(s => s.props('label'))
      expect(labels).toContain('Page UI')
    })

    test('hides Page UI and Style selects when parentPage is set', () => {
      const wrapper = setup({ parentPage: '/_/pages/uuid-2' })
      const selects = wrapper.findAllComponents({ name: 'ModalSelect' })
      const labels = selects.map(s => s.props('label'))
      expect(labels).not.toContain('Page UI')
      expect(labels).not.toContain('Style')
    })
  })

  describe('depth switcher', () => {
    test('shows a "Viewing" ModalSelect when the resource chain has parents in the store', () => {
      const wrapper = setup({}, (iri) => {
        if (iri === '/_/pages/uuid-self') return ref({ data: { reference: 'Programme', parentPage: '/_/pages/uuid-2' } })
        if (iri === '/_/pages/uuid-2') return ref({ data: { reference: 'Conference', parentPage: null } })
        return ref(null)
      })
      const selects = wrapper.findAllComponents({ name: 'ModalSelect' })
      expect(selects.find(s => s.props('label') === 'Viewing')?.exists()).toBe(true)
    })

    test('depth options include the current page and its parent', () => {
      const wrapper = setup({}, (iri) => {
        if (iri === '/_/pages/uuid-self') return ref({ data: { reference: 'Programme', parentPage: '/_/pages/uuid-2' } })
        if (iri === '/_/pages/uuid-2') return ref({ data: { reference: 'Conference', parentPage: null } })
        return ref(null)
      })
      const selects = wrapper.findAllComponents({ name: 'ModalSelect' })
      const depthSelect = selects.find(s => s.props('label') === 'Viewing')
      const options = depthSelect?.props('options') as Array<{ label: string, value: string }>
      expect(options).toContainEqual({ label: 'Programme', value: '/_/pages/uuid-self' })
      expect(options).toContainEqual({ label: 'Conference', value: '/_/pages/uuid-2' })
    })

    test('does not show depth switcher when the resource has no parents', () => {
      const wrapper = setup({}, (iri) => {
        if (iri === '/_/pages/uuid-self') return ref({ data: { reference: 'My Page', parentPage: null } })
        return ref(null)
      })
      const selects = wrapper.findAllComponents({ name: 'ModalSelect' })
      expect(selects.some(s => s.props('label') === 'Viewing')).toBe(false)
    })
  })
})
