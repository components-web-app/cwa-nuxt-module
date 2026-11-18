// @vitest-environment nuxt
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { defineComponent, h, provide, ref } from 'vue'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import PageResourceAdminModal from './PageResourceAdminModal.vue'
import { fakeDialogForm } from '../../../../../../playground/app/kit/fake-dialog-form'
import type { FakeDialogForm } from '../../../../../../playground/app/kit/fake-dialog-form'
import { fieldGroupKey, formSurfaceKey } from '#cwa/templates/components/core/ui/field-keys'
import Input from '#cwa/templates/components/ui/Input.vue'
import Select from '#cwa/templates/components/ui/Select.vue'
import Toggle from '#cwa/templates/components/ui/Toggle.vue'
import Segmented from '#cwa/templates/components/ui/Segmented.vue'
import * as cwaComposable from '#cwa/composables/cwa'
import { componentNames } from '#components'

const mockNavigateTo = vi.hoisted(() => vi.fn())
mockNuxtImport('navigateTo', () => mockNavigateTo)

const { mockUseItemPage, mockUseDynamicPageLoader, mockUseParentPageLoader, mockUseParentPageDataLoader, mockUseDataType, confirmMock, countsMock, requestClose } = vi.hoisted(() => ({
  mockUseItemPage: vi.fn(),
  mockUseDynamicPageLoader: vi.fn(),
  mockUseParentPageLoader: vi.fn(),
  mockUseParentPageDataLoader: vi.fn(),
  mockUseDataType: vi.fn(),
  confirmMock: vi.fn(),
  countsMock: vi.fn(),
  requestClose: vi.fn(),
}))

vi.mock('#cwa-layer/_composables/useItemPage', () => ({ useItemPage: mockUseItemPage }))
vi.mock('#cwa-layer/_composables/useDynamicPageLoader', () => ({ useDynamicPageLoader: mockUseDynamicPageLoader }))
vi.mock('#cwa-layer/_composables/useParentPageLoader', () => ({ useParentPageLoader: mockUseParentPageLoader }))
vi.mock('#cwa-layer/_composables/useParentPageDataLoader', () => ({ useParentPageDataLoader: mockUseParentPageDataLoader }))
vi.mock('#cwa-layer/_composables/useDataType', () => ({ useDataType: mockUseDataType }))
vi.mock('#cwa/composables/cwa-confirm', () => ({ useCwaConfirm: () => confirmMock }))
vi.mock('#cwa/admin/page-delete', async (importOriginal) => {
  const original = await importOriginal<typeof import('#cwa/admin/page-delete')>()
  return { ...original, fetchTemplateCounts: countsMock }
})

enableAutoUnmount(afterEach)

const DialogStub = defineComponent({
  name: 'CwaUiDialog',
  props: ['title', 'tabs', 'form', 'loading', 'noun'],
  emits: ['close', 'save', 'update:tab'],
  setup(props, { slots, expose }) {
    provide(fieldGroupKey, { model: (field: string) => props.form.model(field), undo: () => undefined })
    provide(formSurfaceKey, { unsaved: (field: string) => props.form.unsavedFields.includes(field), register: () => () => {} })
    expose({ requestClose })
    return () => h('div', { 'data-testid': 'dialog-stub' }, [slots['header-actions']?.(), slots.details?.(), slots.routes?.(), slots.info?.()])
  },
})

function setup(opts: {
  iri?: string
  resourceType?: string
  resource?: Record<string, any>
  displayPageIri?: string | undefined
  fqcnToEntrypointKey?: (t: string) => any
  pageDataConfig?: any
  local?: Record<string, any>
  isAdding?: boolean
  pagesConfig?: Record<string, any>
  hideViewLink?: boolean
  parentPages?: Record<string, any>[]
  routes?: Record<string, any>
} = {}) {
  const iri = opts.iri ?? '/_/pages/uuid-self'
  const resource = opts.resource ?? { '@id': iri, '@type': 'Page', 'reference': 'My Page' }
  const form: FakeDialogForm = fakeDialogForm({
    '@id': iri,
    'reference': resource.reference ?? 'My Page',
    'title': resource.title ?? '',
    'metaDescription': '',
    'parentPage': null,
    'parentPageData': null,
    ...opts.local,
  })
  const localResourceData = ref(form.local)

  const handlers = {
    isAdding: ref(opts.isAdding ?? false),
    isLoading: ref(false),
    isUpdating: ref(false),
    localResourceData,
    resource: ref(resource),
    formatDate: vi.fn(() => '1 Jan 2026'),
    deleteResource: vi.fn(),
    saveResource: vi.fn(),
    saveTitle: vi.fn(),
    loadResource: vi.fn(),
    getInternalResourceLink: vi.fn((resourceIri: string) => ({ name: '_cwa-resource-page', params: { cwaPage0: resourceIri } })),
    form,
  }
  mockUseItemPage.mockReturnValue(handlers)

  mockUseDynamicPageLoader.mockReturnValue({ dynamicPages: ref([]), loadDynamicPageOptions: vi.fn() })
  mockUseParentPageLoader.mockReturnValue({ parentPages: ref(opts.parentPages ?? []), loadParentPageOptions: vi.fn() })
  mockUseParentPageDataLoader.mockReturnValue({
    dataTypes: ref([{ resourceClass: 'App\\Entity\\BlogArticleData' }]),
    dataInstances: ref([]),
    loadDataTypes: vi.fn(),
    loadDataInstances: vi.fn(),
    fqcnToEntrypointKey: vi.fn(opts.fqcnToEntrypointKey ?? ((t: string) => t.split('\\').pop()!.replace(/^./, c => c.toLowerCase()))),
  })
  mockUseDataType.mockReturnValue({ pageDataConfig: ref(opts.pageDataConfig ?? null) })

  const getResource = vi.fn((resourceIri: string) => ref(opts.routes?.[resourceIri] ? { data: opts.routes[resourceIri] } : null))
  vi.spyOn(cwaComposable, 'useCwa').mockImplementation(() => ({
    resources: {
      displayPageIri: ref(opts.displayPageIri),
      getResource,
    },
    fetch: vi.fn().mockReturnValue({ response: Promise.resolve({ _data: null }) }),
    getApiDocumentation: vi.fn().mockResolvedValue({ entrypoint: { blogArticleData: '/page_data/blog_article_datas' } }),
    pagesConfig: opts.pagesConfig ?? {},
    admin: { toggleEdit: vi.fn() },
  }) as unknown as ReturnType<typeof cwaComposable.useCwa>)

  const wrapper = mount(PageResourceAdminModal, {
    props: { iri, resourceType: opts.resourceType ?? 'Page', hideViewLink: opts.hideViewLink ?? true },
    global: {
      stubs: {
        CwaUiDialog: DialogStub,
        RoutesTab: true,
        PagePurgeCache: { name: 'PagePurgeCache', template: '<div />' },
      },
    },
  })

  return { wrapper, handlers, form, localResourceData }
}

function setupPageData(opts: Parameters<typeof setup>[0] = {}) {
  return setup({
    iri: '/page_data/uuid-self',
    resourceType: 'App\\Entity\\EventData',
    resource: { '@id': '/page_data/uuid-self', '@type': 'App\\Entity\\EventData', 'title': 'An event' },
    ...opts,
  })
}

const field = (wrapper: ReturnType<typeof mount>, component: any, label: string) => wrapper.findAllComponents(component).find(found => found.props('label') === label)!

async function clickDelete(wrapper: ReturnType<typeof mount>) {
  await wrapper.get('[data-testid="page-delete"]').trigger('click')
  await flushPromises()
}

describe('PageResourceAdminModal on the kit dialog (#461)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    countsMock.mockResolvedValue({})
  })

  test('the dialog is titled with the stored reference and gets the Save model from useItemPage', () => {
    const { wrapper, form } = setup()
    const dialog = wrapper.findComponent(DialogStub)

    expect(dialog.props('title')).toBe('My Page')
    expect(dialog.props('form')).toStrictEqual(form)
    expect(dialog.props('tabs')).toEqual([{ label: 'Details', key: 'details' }, { label: 'Routes', key: 'routes' }, { label: 'Info', key: 'info' }])
  })

  test('creating shows only Details', () => {
    const { wrapper } = setup({ isAdding: true })

    expect(wrapper.findComponent(DialogStub).props('tabs')).toEqual([{ label: 'Details', key: 'details' }])
  })

  test('Save on the dialog saves without closing, and nothing is saved as you type', async () => {
    const { wrapper, handlers } = setup()

    await wrapper.get('[data-cwa-field="reference"] input').setValue('Renamed')
    expect(handlers.saveResource).not.toHaveBeenCalled()
    await wrapper.findComponent(DialogStub).vm.$emit('save')

    expect(handlers.saveResource).toHaveBeenCalledWith(false)
  })

  test('typing in a field edits the local copy and marks it unsaved', async () => {
    const { wrapper, form } = setup()

    await wrapper.get('[data-cwa-field="reference"] input').setValue('Renamed')

    expect(form.local.reference).toBe('Renamed')
    expect(form.unsavedFields).toEqual(['reference'])
    expect(wrapper.find('[data-cwa-field="reference"] [data-testid="field-unsaved"]').exists()).toBe(true)
  })

  test('changing the page type is a change to save, never saved on its own', async () => {
    const { wrapper, form, handlers } = setup({ local: { isTemplate: false } })

    await field(wrapper, Segmented, 'Page type').findAll('button').find(b => b.text() === 'Template')!.trigger('click')

    expect(form.local.isTemplate).toBe(true)
    expect(form.unsavedFields).toEqual(['isTemplate'])
    expect(handlers.saveResource).not.toHaveBeenCalled()
  })

  test('choosing to nest under nothing clears the parent in the local copy, so Save counts it', async () => {
    const { wrapper, form } = setup({ local: { parentPage: '/_/pages/parent' }, resource: { '@id': '/_/pages/uuid-self', '@type': 'Page', 'reference': 'My Page', 'parentPage': '/_/pages/parent' } })
    form.discard()

    await field(wrapper, Segmented, 'Nested under').findAll('button').find(b => b.text() === 'Nothing')!.trigger('click')

    expect(form.local.parentPage).toBeNull()
    expect(form.unsavedFields).toEqual(['parentPage'])
  })

  test('the parent page options leave out the page itself and its descendants', () => {
    const { wrapper } = setup({
      local: { parentPage: '/_/pages/a' },
      parentPages: [
        { '@id': '/_/pages/uuid-self', 'reference': 'Self' },
        { '@id': '/_/pages/a', 'reference': 'A' },
        { '@id': '/_/pages/child', 'reference': 'Child', 'parentPage': '/_/pages/uuid-self' },
      ],
    })

    expect(field(wrapper, Select, 'Parent page').props('options')).toEqual([{ label: 'A', value: '/_/pages/a' }])
  })

  test('public without a route is a field, off while the page has a route', () => {
    const routed = setup({ resource: { '@id': '/_/pages/uuid-self', '@type': 'Page', 'reference': 'My Page', 'route': '/_/routes/r' } })
    expect(field(routed.wrapper, Toggle, 'Public without a route').props()).toMatchObject({ field: 'isReachableWithoutRoute', disabled: true })

    const unrouted = setupPageData()
    expect(field(unrouted.wrapper, Toggle, 'Public without a route').props('disabled')).toBe(false)
  })

  test('the view button navigates to the page with cwa_force once the dialog has closed, and is hidden on the page on screen', async () => {
    requestClose.mockResolvedValueOnce(true)
    const { wrapper } = setup({ hideViewLink: false })

    await wrapper.get('[data-testid="page-view-on-site"]').trigger('click')
    await flushPromises()

    expect(requestClose).toHaveBeenCalled()
    expect(mockNavigateTo).toHaveBeenCalledWith({ name: '_cwa-resource-page', params: { cwaPage0: '/_/pages/uuid-self' }, query: { cwa_force: 'true' } })
    expect(setup().wrapper.find('[data-testid="page-view-on-site"]').exists()).toBe(false)
  })

  test('the view button stays put when Keep editing is chosen', async () => {
    requestClose.mockResolvedValueOnce(false)
    const { wrapper } = setup({ hideViewLink: false })

    await wrapper.get('[data-testid="page-view-on-site"]').trigger('click')
    await flushPromises()

    expect(mockNavigateTo).not.toHaveBeenCalled()
  })
})

describe('PageResourceAdminModal delete (#461)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    countsMock.mockResolvedValue({})
  })

  test('the Info tab\'s last section says what deleting keeps, from the same sentences as the confirm', () => {
    const { wrapper } = setup({
      resource: { '@id': '/_/pages/uuid-self', '@type': 'Page', 'reference': 'My Page', 'route': '/_/routes/r' },
      routes: { '/_/routes/r': { path: '/kitchens' } },
      parentPages: [{ '@id': '/_/pages/child', 'reference': 'Child', 'parentPage': '/_/pages/uuid-self' }],
    })

    expect(wrapper.get('[data-testid="page-delete-section"]').text()).toContain('The route /kitchens is kept, and visitors to it get “Page not found”. The page nested under it is kept and loses its parent.')
  })

  test('asks to type the page name, counting the template\'s pages fresh before the confirm opens', async () => {
    countsMock.mockResolvedValueOnce({ templatePages: 14, addresses: 12 })
    const { wrapper, handlers } = setup({ resource: { '@id': '/_/pages/uuid-self', '@type': 'Page', 'reference': 'Shaker kitchens', 'isTemplate': true } })
    confirmMock.mockResolvedValueOnce(false)

    await clickDelete(wrapper)

    expect(countsMock).toHaveBeenCalledWith(expect.anything(), '/_/pages/uuid-self', ['/page_data/blog_article_datas'])
    expect(confirmMock).toHaveBeenCalledWith({
      title: 'Delete “Shaker kitchens”?',
      lines: [
        { text: '14 pages built from this template are deleted too. Visitors to their 12 addresses get “Page not found”.', emphasis: 'strong' },
        { text: 'This can\'t be undone.' },
      ],
      keep: 'Don\'t delete',
      go: 'Delete page',
      typed: { noun: 'page name', value: 'Shaker kitchens' },
    })
    expect(handlers.deleteResource).not.toHaveBeenCalled()
  })

  test('a page that is not a template is not counted', async () => {
    const { wrapper } = setup()
    confirmMock.mockResolvedValueOnce(false)

    await clickDelete(wrapper)

    expect(countsMock).not.toHaveBeenCalled()
  })

  test('the confirm says unsaved edits are discarded too', async () => {
    const { wrapper } = setup()
    await wrapper.get('[data-cwa-field="reference"] input').setValue('Renamed')
    confirmMock.mockResolvedValueOnce(false)

    await clickDelete(wrapper)

    expect(confirmMock.mock.calls[0]![0].lines).toContainEqual({ text: 'Your 1 unsaved change is discarded too.' })
    expect(confirmMock.mock.calls[0]![0].title).toBe('Delete “My Page”?')
  })

  test('once confirmed it deletes without a second confirm, discards the local copy and goes to the pages list when it is the page on screen', async () => {
    confirmMock.mockResolvedValueOnce(true)
    const { wrapper, handlers, form } = setup({ displayPageIri: '/_/pages/uuid-self' })
    await wrapper.get('[data-cwa-field="reference"] input').setValue('Renamed')

    await clickDelete(wrapper)

    expect(handlers.deleteResource).toHaveBeenCalledWith(undefined, expect.any(Function), true)
    await (handlers.deleteResource.mock.calls[0] as unknown as [unknown, () => Promise<void>])[1]()
    expect(form.unsavedFields).toEqual([])
    expect(mockNavigateTo).toHaveBeenCalledWith({ name: '_cwa-pages', query: { cwa_force: 'true' } })
  })

  test.each([
    [(t: string) => t === 'App\\Entity\\EventData' ? 'event_data' : null, { name: '_cwa-data-type', params: { type: 'event_data' }, query: { cwa_force: 'true' } }],
    [() => null, { name: '_cwa-data', query: { cwa_force: 'true' } }],
  ])('deleting the data page on screen goes to its list', async (fqcnToEntrypointKey, destination) => {
    confirmMock.mockResolvedValueOnce(true)
    const { wrapper, handlers } = setupPageData({ displayPageIri: '/page_data/uuid-self', fqcnToEntrypointKey })

    await clickDelete(wrapper)
    await (handlers.deleteResource.mock.calls[0] as unknown as [unknown, () => Promise<void>])[1]()

    expect(mockNavigateTo).toHaveBeenCalledWith(destination)
    expect(confirmMock.mock.calls[0]![0].typed).toEqual({ noun: 'page name', value: 'An event' })
  })

  test('deleting a page that is not on screen does not navigate', async () => {
    confirmMock.mockResolvedValueOnce(true)
    const { wrapper, handlers } = setup({ displayPageIri: undefined })

    await clickDelete(wrapper)
    await (handlers.deleteResource.mock.calls[0] as unknown as [unknown, () => Promise<void>])[1]()

    expect(mockNavigateTo).not.toHaveBeenCalled()
  })

  test('Don\'t delete deletes nothing', async () => {
    confirmMock.mockResolvedValueOnce(false)
    const { wrapper, handlers } = setup()

    await clickDelete(wrapper)

    expect(handlers.deleteResource).not.toHaveBeenCalled()
  })

  test('the template counts are refreshed whenever the Info tab is shown', async () => {
    countsMock.mockResolvedValue({ templatePages: 2, addresses: 2 })
    const { wrapper } = setup({ resource: { '@id': '/_/pages/uuid-self', '@type': 'Page', 'reference': 'T', 'isTemplate': true } })

    await wrapper.findComponent(DialogStub).vm.$emit('update:tab', 'info')
    await flushPromises()

    expect(countsMock).toHaveBeenCalledOnce()
    expect(wrapper.get('[data-testid="page-delete-section"]').text()).toContain('2 pages built from this template are deleted too. Visitors to their 2 addresses get “Page not found”.')
  })
})

describe('PageResourceAdminModal meta fields config', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('a meta field declaring type "input" is an input bound to its field, any other a select whose null option is its None option', () => {
    const { wrapper } = setupPageData({
      pageDataConfig: {
        metaFields: [
          { field: 'subtitle', type: 'input', label: 'Subtitle' },
          { field: 'category', type: 'select', label: 'Category', options: [{ label: 'A', value: 'a' }, { label: 'None', value: null }] },
          { field: 'status', label: 'Status' },
        ],
      },
      local: { subtitle: 'Hello', category: 'a', status: null },
    })

    expect(field(wrapper, Input, 'Subtitle').props('field')).toBe('subtitle')
    expect(field(wrapper, Select, 'Subtitle')).toBeUndefined()
    expect(field(wrapper, Select, 'Category').props()).toMatchObject({ field: 'category', options: [{ label: 'A', value: 'a' }, { label: 'None', value: null }], nullable: true })
    expect(field(wrapper, Select, 'Status').props('field')).toBe('status')
    expect(wrapper.get('[data-cwa-field="subtitle"] input').element).toHaveProperty('value', 'Hello')
  })

  test('typing in a meta field writes back to the local copy', async () => {
    const { wrapper, form } = setupPageData({
      pageDataConfig: { metaFields: [{ field: 'subtitle', type: 'input', label: 'Subtitle' }] },
      local: { subtitle: 'Hello' },
    })

    await wrapper.get('[data-cwa-field="subtitle"] input').setValue('Updated')

    expect(form.local.subtitle).toBe('Updated')
  })
})

describe('PageResourceAdminModal Page UI select stores the full CwaPage component name (#384)', () => {
  const pagesConfig = { PrimaryPageTemplate: { name: 'Primary Page Template' } }
  const pageNames = componentNames.filter((n: string) => n.startsWith('CwaPage'))

  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('lists every registered CwaPage component with its full name as the value, named from pagesConfig', () => {
    const { wrapper } = setup({ pagesConfig })
    expect(field(wrapper, Select, 'Page UI').props('options')).toEqual(pageNames.map((name: string) => {
      const cleanName = name.replace(/^CwaPage/, '')
      return { label: pagesConfig[cleanName as keyof typeof pagesConfig]?.name || cleanName, value: name }
    }))
  })

  test('a page the API returned with the full name selects its option', () => {
    const { wrapper } = setup({ pagesConfig, local: { uiComponent: 'CwaPagePrimaryPageTemplate' } })
    expect(field(wrapper, Select, 'Page UI').props('model').model.value).toBe('CwaPagePrimaryPageTemplate')
  })

  test('a page stored short before the API prefixed it still selects its full-name option, without changing the resource', () => {
    const { wrapper, form, handlers } = setup({ pagesConfig, local: { uiComponent: 'PrimaryPageTemplate' } })
    expect(field(wrapper, Select, 'Page UI').props('model').model.value).toBe('CwaPagePrimaryPageTemplate')
    expect(form.local.uiComponent).toBe('PrimaryPageTemplate')
    expect(form.unsavedFields).toEqual([])
    expect(handlers.saveResource).not.toHaveBeenCalled()
  })

  test('choosing an option stores the full component name, marked as the uiComponent field', () => {
    const { wrapper, form } = setup({ pagesConfig, local: { uiComponent: 'CwaPagePrimaryPageTemplate' } })
    const model = field(wrapper, Select, 'Page UI').props('model')
    model.model.value = 'CwaPageNestedTopicTemplate'
    expect(form.local.uiComponent).toBe('CwaPageNestedTopicTemplate')
    expect(model.field).toBe('uiComponent')
  })
})

describe('PageResourceAdminModal page cache purge (#484)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('offers purging the page\'s cache when the modal is open for the page on screen', () => {
    const { wrapper } = setup({ displayPageIri: '/_/pages/uuid-self' })
    expect(wrapper.findComponent({ name: 'PagePurgeCache' }).exists()).toBe(true)
  })

  test('does not offer it for a page that is not on screen, whose manifest is not loaded', () => {
    const { wrapper } = setup({ displayPageIri: '/_/pages/another' })
    expect(wrapper.findComponent({ name: 'PagePurgeCache' }).exists()).toBe(false)
  })
})
