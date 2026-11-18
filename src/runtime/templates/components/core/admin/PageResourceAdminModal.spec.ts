// @vitest-environment nuxt
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { computed, defineComponent, h, provide, reactive, ref } from 'vue'
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
import Button from '#cwa/templates/components/ui/Button.vue'
import EyeGlyph from '#cwa/templates/components/ui/icon/EyeIcon.vue'
import * as cwaComposable from '#cwa/composables/cwa'
import { componentNames } from '#components'
import { consola } from 'consola'
import { drawsFocusRing } from '../../../../../../test/utils/focus-ring'
import { axe } from '../../../../../../test/utils/axe'
import { fieldExplanation } from '../../../../../../test/utils/field-info'

const mockNavigateTo = vi.hoisted(() => vi.fn())
const routeState = vi.hoisted(() => ({ route: undefined as unknown as { params: Record<string, string>, query: Record<string, string>, hash: string } }))
mockNuxtImport('navigateTo', () => mockNavigateTo)

const { mockUseItemPage, mockUseDynamicPageLoader, mockUseParentPageLoader, mockUseParentPageDataLoader, mockUseDataType, confirmMock, countsMock, requestClose, confirmDiscard } = vi.hoisted(() => ({
  mockUseItemPage: vi.fn(),
  mockUseDynamicPageLoader: vi.fn(),
  mockUseParentPageLoader: vi.fn(),
  mockUseParentPageDataLoader: vi.fn(),
  mockUseDataType: vi.fn(),
  confirmMock: vi.fn(),
  countsMock: vi.fn(),
  requestClose: vi.fn(),
  confirmDiscard: vi.fn(),
}))

vi.mock('#cwa-layer/_composables/useItemPage', () => ({ useItemPage: mockUseItemPage }))
vi.mock('vue-router', async (importOriginal) => {
  const mod = await importOriginal<typeof import('vue-router')>()
  const { reactive } = await import('vue')
  routeState.route = reactive({ params: {}, query: {}, hash: '' })
  return { ...mod, useRoute: () => routeState.route }
})
vi.mock('#cwa-layer/_composables/useDynamicPageLoader', () => ({ useDynamicPageLoader: mockUseDynamicPageLoader }))
vi.mock('#cwa-layer/_composables/useParentPageLoader', () => ({ useParentPageLoader: mockUseParentPageLoader }))
vi.mock('#cwa-layer/_composables/useParentPageDataLoader', () => ({ useParentPageDataLoader: mockUseParentPageDataLoader }))
vi.mock('#cwa-layer/_composables/useDataType', () => ({ useDataType: mockUseDataType }))
vi.mock('#cwa/composables/cwa-confirm', () => ({ useCwaConfirm: () => confirmMock }))
const realtime = vi.hoisted(() => ({ peers: vi.fn((_iri: string): unknown[] => []) }))
vi.mock('#cwa/resources/realtime-view', () => ({
  realtimeView: () => ({ load: async () => ({ peers: realtime.peers }) }),
}))
vi.mock('#cwa/admin/page-delete', async (importOriginal) => {
  const original = await importOriginal<typeof import('#cwa/admin/page-delete')>()
  return { ...original, fetchTemplateCounts: countsMock }
})

enableAutoUnmount(afterEach)
afterEach(() => {
  requestClose.mockReset()
  confirmDiscard.mockReset()
})

const DialogStub = defineComponent({
  name: 'CwaUiDialog',
  props: ['title', 'tabs', 'form', 'loading', 'noun', 'createNoun', 'tab', 'kind', 'placement'],
  emits: ['close', 'save', 'update:tab'],
  setup(props, { slots, expose }) {
    provide(fieldGroupKey, { model: (field: string) => props.form.model(field), undo: () => undefined })
    provide(formSurfaceKey, { unsaved: (field: string) => props.form.unsavedFields.includes(field), register: () => () => {} })
    expose({ requestClose, confirmDiscard })
    return () => h('div', { 'data-testid': 'dialog-stub' }, [h('div', { 'data-testid': 'stub-header' }, slots['header-actions']?.()), h('div', { 'data-testid': 'stub-subheader' }, slots.subheader?.()), ...(props.loading ? [] : [slots.details?.(), slots.routes?.(), slots.info?.()])])
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
  stored?: Record<string, any>
  routeIri?: string
  apiDocumentation?: Promise<unknown>
  query?: Record<string, string>
  hash?: string
  pageDataTypes?: Record<string, any>
  layouts?: Record<string, any>[]
  dynamicPages?: Record<string, any>[]
  loadDynamicPageOptions?: () => Promise<unknown>
  loadParentPageOptions?: () => Promise<unknown>
  fetchData?: (path: string) => unknown
  attach?: boolean
  loading?: boolean
  fetchResource?: (props: { path: string }) => Promise<unknown>
} = {}) {
  const iri = opts.iri ?? opts.routeIri ?? '/_/pages/uuid-self'
  routeState.route.params = opts.routeIri ? { iri: opts.routeIri } : {}
  routeState.route.query = opts.query ?? {}
  routeState.route.hash = opts.hash ?? ''
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
  const localResourceData = ref(opts.loading ? undefined : form.local)

  const handlers = {
    isAdding: ref(opts.isAdding ?? false),
    isLoading: ref(!!opts.loading),
    isUpdating: ref(false),
    localResourceData,
    resource: ref(opts.loading ? undefined : resource),
    formatDate: vi.fn(() => '1 Jan 2026'),
    deleteResource: vi.fn(),
    saveResource: vi.fn(),
    saveTitle: vi.fn(),
    loadResource: vi.fn(),
    getInternalResourceLink: vi.fn((resourceIri: string) => ({ name: '_cwa-resource-page', params: { cwaPage0: resourceIri } })),
    form,
  }
  mockUseItemPage.mockReturnValue(handlers)

  mockUseDynamicPageLoader.mockReturnValue({ dynamicPages: ref(opts.dynamicPages ?? [{ '@id': '/_/pages/default-template', 'reference': 'Default template' }]), loadDynamicPageOptions: vi.fn(opts.loadDynamicPageOptions ?? (async () => undefined)) })
  mockUseParentPageLoader.mockReturnValue({ parentPages: ref(opts.parentPages ?? []), loadParentPageOptions: vi.fn(opts.loadParentPageOptions ?? (async () => undefined)) })
  mockUseParentPageDataLoader.mockReturnValue({
    dataTypes: ref([{ resourceClass: 'App\\Entity\\BlogArticleData' }]),
    dataInstances: ref([]),
    loadDataTypes: vi.fn(async () => undefined),
    loadDataInstances: vi.fn(),
    fqcnToEntrypointKey: vi.fn(opts.fqcnToEntrypointKey ?? ((t: string) => t.split('\\').pop()!.replace(/^./, c => c.toLowerCase()))),
  })
  mockUseDataType.mockReturnValue({ pageDataConfig: ref(opts.pageDataConfig ?? null) })

  const storedData = reactive<Record<string, any>>({ ...opts.routes, ...opts.stored })
  const getResource = vi.fn((resourceIri: string) => computed(() => storedData[resourceIri] ? { data: storedData[resourceIri] } : null))
  const fetchResource = vi.fn(opts.fetchResource ?? (async () => undefined))
  vi.spyOn(cwaComposable, 'useCwa').mockImplementation(() => ({
    resources: {
      displayPageIri: ref(opts.displayPageIri),
      getResource,
    },
    fetch: vi.fn(({ path }: { path: string }) => ({ response: Promise.resolve({ _data: opts.fetchData ? opts.fetchData(path) : path.startsWith('/_/layouts') ? { member: opts.layouts ?? [{ '@id': '/_/layouts/default', 'reference': 'Default' }] } : null }) })),
    getApiDocumentation: vi.fn(() => opts.apiDocumentation ?? Promise.resolve({ entrypoint: { blogArticleData: '/page_data/blog_article_datas' } })),
    fetchResource,
    pagesConfig: opts.pagesConfig ?? {},
    pageDataConfig: opts.pageDataTypes ?? {},
    admin: { toggleEdit: vi.fn() },
  }) as unknown as ReturnType<typeof cwaComposable.useCwa>)

  const wrapper = mount(PageResourceAdminModal, {
    props: { ...(opts.routeIri ? {} : { iri }), resourceType: opts.resourceType ?? 'Page', hideViewLink: opts.hideViewLink ?? true },
    attachTo: opts.attach ? document.body : undefined,
    global: {
      stubs: {
        CwaUiDialog: DialogStub,
        RoutesTab: true,
        PagePurgeCache: { name: 'PagePurgeCache', template: '<div />' },
      },
    },
  })

  return { wrapper, handlers, form, localResourceData, storedData, fetchResource }
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
  await vi.dynamicImportSettled()
  await flushPromises()
}

describe('PageResourceAdminModal on the kit dialog (#461)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    countsMock.mockResolvedValue({})
  })

  test('the dialog opens at once while its resource loads: titled by its kind, busy, with a neutral line and no page type until it arrives', async () => {
    const { wrapper, handlers, form, localResourceData } = setup({ loading: true, hideViewLink: false })
    const dialog = () => wrapper.findComponent(DialogStub)

    expect(dialog().exists()).toBe(true)
    expect(dialog().props()).toMatchObject({ title: 'Page', loading: true, kind: undefined })
    expect(wrapper.find('[data-testid="page-type"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="page-view-on-site"]').exists()).toBe(true)

    handlers.isLoading.value = false
    localResourceData.value = form.local
    handlers.resource.value = { '@id': '/_/pages/uuid-self', '@type': 'Page', 'reference': 'My Page' }
    await flushPromises()
    expect(dialog().props()).toMatchObject({ title: 'My Page', loading: false, kind: { tone: 'static' } })
    expect(wrapper.find('[data-testid="page-type"]').exists()).toBe(true)
  })

  test('page data loading is titled Page data, and a load that ends with nothing closes nothing open', async () => {
    const { wrapper, handlers } = setupPageData({ loading: true })
    expect(wrapper.findComponent(DialogStub).props('title')).toBe('Page data')

    handlers.isLoading.value = false
    await flushPromises()
    expect(wrapper.findComponent(DialogStub).exists()).toBe(false)
  })

  test('the dialog is titled with the stored reference and gets the Save model from useItemPage', () => {
    const { wrapper, form } = setup()
    const dialog = wrapper.findComponent(DialogStub)

    expect(dialog.props('title')).toBe('My Page')
    expect(dialog.props('form')).toStrictEqual(form)
    expect(dialog.props('tabs')).toEqual([{ label: 'Details', key: 'details' }, { label: 'Routes', key: 'routes' }, { label: 'Info', key: 'info' }])
  })

  test('the dialog shows a failed save itself, so it alone asks useItemPage to dismiss the stored error', () => {
    setup()

    expect(mockUseItemPage).toHaveBeenCalledWith(expect.objectContaining({ dismissStoredErrors: true }))
  })

  test('opened from /_cwa/routes/<iri> without an iri, a page opens as a page: its fields, depths, parent filter and typed delete', async () => {
    const routeIri = '/_/pages/uuid-self'
    const stored = {
      [routeIri]: { '@id': routeIri, 'reference': 'Child', 'parentPage': '/_/pages/parent' },
      '/_/pages/parent': { '@id': '/_/pages/parent', 'reference': 'Parent' },
    }
    const { wrapper } = setup({
      routeIri,
      stored,
      resource: { '@id': routeIri, '@type': 'Page', 'reference': 'Child', 'parentPage': '/_/pages/parent' },
      local: { parentPage: '/_/pages/parent' },
      parentPages: [
        { '@id': routeIri, 'reference': 'Child', 'parentPage': '/_/pages/parent' },
        { '@id': '/_/pages/parent', 'reference': 'Parent' },
        { '@id': '/_/pages/grandchild', 'reference': 'Grandchild', 'parentPage': routeIri },
      ],
    })

    expect(mockUseItemPage.mock.calls[0]![0].endpoint.value).toBe(routeIri)
    expect(wrapper.find('[data-cwa-field="reference"]').exists()).toBe(true)
    expect(field(wrapper, Select, 'Page type')).toBeDefined()
    expect(field(wrapper, Select, 'Layout')).toBeDefined()
    expect(field(wrapper, Select, 'Page UI')).toBeDefined()
    expect(field(wrapper, Segmented, 'Editing').props('options')).toEqual([{ label: 'Parent', value: '/_/pages/parent' }, { label: 'Child', value: routeIri }])
    expect(field(wrapper, Select, 'Parent page').props('options')).toEqual([{ label: 'Parent', value: '/_/pages/parent' }])
    confirmMock.mockResolvedValueOnce(false)
    await clickDelete(wrapper)
    expect(confirmMock.mock.calls[0]![0]).toMatchObject({ title: 'Delete “Child”?', typed: { noun: 'page name', value: 'Child' } })
  })

  test('creating a page shows Details, a Routes tab that says why it is not open yet, and no Info', () => {
    const { wrapper } = setup({ routeIri: 'add', isAdding: true })

    expect(wrapper.findComponent(DialogStub).props('tabs')).toEqual([
      { label: 'Details', key: 'details' },
      { label: 'Routes', key: 'routes', disabled: 'Routes open once the page is created. Create the page and this tab lets you add its address.' },
    ])
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

  const pageType = (wrapper: ReturnType<typeof mount>) => field(wrapper, Select, 'Page type')

  test('the page type is a select in the dialog header, Static or Dynamic, each with its round dot in the list\'s colours', () => {
    const { wrapper } = setup({ local: { isTemplate: false } })

    const select = pageType(wrapper)
    expect(wrapper.get('[data-testid="stub-header"]').element.contains(select.element)).toBe(true)
    expect(select.classes()).toContain('cwa:me-2')
    expect(select.props()).toMatchObject({ labelHidden: true })
    expect(select.props('options')).toEqual([
      { label: 'Static', value: 'static', dot: 'cwa:bg-type-static' },
      { label: 'Dynamic', value: 'template', dot: 'cwa:bg-type-dynamic' },
    ])
    expect(select.props('model').model.value).toBe('static')
    expect(field(wrapper, Segmented, 'Page type')).toBeUndefined()
  })

  test('the page type select is in the header when the view link is not, and while creating a page', () => {
    expect(pageType(setup({ hideViewLink: true }).wrapper)).toBeDefined()
    expect(pageType(setup({ routeIri: 'add', isAdding: true }).wrapper)).toBeDefined()
    expect(pageType(setupPageData().wrapper)).toBeUndefined()
  })

  test('changing the page type is a change to save, never saved on its own', async () => {
    const { wrapper, form, handlers } = setup({ local: { isTemplate: false } })

    pageType(wrapper).props('model').model.value = 'template'
    await flushPromises()

    expect(form.local.isTemplate).toBe(true)
    expect(form.unsavedFields).toEqual(['isTemplate'])
    expect(handlers.saveResource).not.toHaveBeenCalled()
  })

  test.each([
    [false, { tone: 'static' }],
    [true, { tone: 'dynamic' }],
  ])('a page with isTemplate %s colours the header line %o, the select beside it saying the type', (isTemplate, kind) => {
    const { wrapper } = setup({ local: { isTemplate } })

    expect(wrapper.findComponent(DialogStub).props('kind')).toEqual(kind)
  })

  test('switching the page type recolours the header line at once, before it is saved', async () => {
    const { wrapper, handlers } = setup({ local: { isTemplate: false } })

    pageType(wrapper).props('model').model.value = 'template'
    await flushPromises()

    expect(wrapper.findComponent(DialogStub).props('kind')).toEqual({ tone: 'dynamic' })
    expect(handlers.saveResource).not.toHaveBeenCalled()
  })

  test('a page public without a route keeps its page type line', () => {
    const { wrapper } = setup({ local: { isTemplate: false, isReachableWithoutRoute: true } })

    expect(wrapper.findComponent(DialogStub).props('kind')).toEqual({ tone: 'static' })
  })

  test.each([
    [{ route: '/_/routes/r' }, { isReachableWithoutRoute: false }, { tone: 'success', label: 'Reachable' }],
    [{ route: null }, { isReachableWithoutRoute: true }, { tone: 'success', label: 'Reachable' }],
    [{ route: null }, { isReachableWithoutRoute: false }, { tone: 'warning', label: 'Not reachable' }],
  ])('page data with %o and %o gives the dialog the %o kind', (saved, local, kind) => {
    const { wrapper } = setupPageData({
      resource: { '@id': '/page_data/uuid-self', '@type': 'App\\Entity\\EventData', 'title': 'An event', ...saved },
      local,
    })

    expect(wrapper.findComponent(DialogStub).props('kind')).toEqual(kind)
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

  test('Reference explains itself behind ⓘ, not as a line under the field', () => {
    const reference = field(setup().wrapper, Input, 'Reference')
    expect(fieldExplanation(reference.element, 'Only admins see this. It names the page in lists.')).toEqual({ info: true, line: false })
  })

  test('the page and page data dialogs slide over from the right, so switching tabs never moves its header or footer, while creating too', () => {
    expect(setup().wrapper.findComponent(DialogStub).props('placement')).toBe('right')
    expect(setupPageData().wrapper.findComponent(DialogStub).props('placement')).toBe('right')
    expect(setup({ routeIri: 'add', isAdding: true }).wrapper.findComponent(DialogStub).props('placement')).toBe('right')
  })

  test('public without a route is not a Details field: it lives on the Routes tab, with the route it stands in for (bundle#381)', () => {
    expect(field(setup().wrapper, Toggle, 'Public without a route')).toBeUndefined()
    expect(field(setupPageData().wrapper, Toggle, 'Public without a route')).toBeUndefined()
  })

  test('a parent not loaded yet is fetched once, so the depths name it; its IRI stands in while it loads or if it fails, and its own parent follows', async () => {
    const answers: Record<string, () => void> = {}
    const { wrapper, storedData, fetchResource } = setup({
      stored: { '/_/pages/uuid-self': { '@id': '/_/pages/uuid-self', 'reference': 'Child', 'parentPage': '/_/pages/parent' } },
      fetchResource: ({ path }) => new Promise<void>((resolve) => {
        answers[path] = resolve
      }),
    })
    await flushPromises()
    const options = () => field(wrapper, Segmented, 'Editing').props('options').map((option: { label: string }) => option.label)

    expect(fetchResource).toHaveBeenCalledTimes(1)
    expect(fetchResource).toHaveBeenCalledWith(expect.objectContaining({ path: '/_/pages/parent' }))
    expect(options()).toEqual(['/_/pages/parent', 'Child'])

    storedData['/_/pages/parent'] = { '@id': '/_/pages/parent', 'reference': 'Parent', 'parentPage': '/_/pages/grandparent' }
    answers['/_/pages/parent']!()
    await flushPromises()
    expect(options()).toEqual(['/_/pages/grandparent', 'Parent', 'Child'])
    expect(fetchResource).toHaveBeenCalledWith(expect.objectContaining({ path: '/_/pages/grandparent' }))

    answers['/_/pages/grandparent']!()
    await flushPromises()
    expect(options()).toEqual(['/_/pages/grandparent', 'Parent', 'Child'])
    expect(fetchResource).toHaveBeenCalledTimes(2)
  })

  test('a new page fetches nothing for its depths', async () => {
    const { fetchResource } = setup({ routeIri: 'add', isAdding: true })
    await flushPromises()
    expect(fetchResource).not.toHaveBeenCalled()
  })

  test('switching the depth being edited asks the dialog to confirm discarding unsaved edits, and switches only on Discard; a long chain scrolls sideways under the header instead of widening the dialog', async () => {
    const stored = {
      '/_/pages/uuid-self': { '@id': '/_/pages/uuid-self', 'reference': 'Child', 'parentPage': '/_/pages/parent' },
      '/_/pages/parent': { '@id': '/_/pages/parent', 'reference': 'Parent' },
    }
    const { wrapper } = setup({ stored })
    const endpoint = mockUseItemPage.mock.calls[0]![0].endpoint
    const editing = field(wrapper, Segmented, 'Editing')
    expect(editing.props('options')).toEqual([{ label: 'Parent', value: '/_/pages/parent' }, { label: 'Child', value: '/_/pages/uuid-self' }])
    expect(wrapper.get('[data-testid="stub-subheader"]').element.contains(editing.element)).toBe(true)
    expect(wrapper.get('[data-testid="page-depths"]').classes()).toContain('cwa:overflow-x-auto')

    confirmDiscard.mockResolvedValueOnce(false)
    await editing.findAll('button').find(b => b.text() === 'Parent')!.trigger('click')
    await flushPromises()
    expect(confirmDiscard).toHaveBeenCalledOnce()
    expect(endpoint.value).toBe('/_/pages/uuid-self')

    confirmDiscard.mockResolvedValueOnce(true)
    await editing.findAll('button').find(b => b.text() === 'Parent')!.trigger('click')
    await flushPromises()
    expect(endpoint.value).toBe('/_/pages/parent')
  })

  test('the view button navigates to the page with cwa_force once the dialog has closed, and is hidden on the page on screen', async () => {
    requestClose.mockResolvedValueOnce(true)
    const { wrapper } = setup({ hideViewLink: false })

    expect(wrapper.findAllComponents(Button).find(button => button.attributes('data-testid') === 'page-view-on-site')!.props('largeIcon')).toBe(true)
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

describe('PageResourceAdminModal Routes tab links (#461)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    countsMock.mockResolvedValue({})
  })

  const routesTab = (wrapper: ReturnType<typeof mount>) => wrapper.findComponent({ name: 'RoutesTab' })

  test('opening a parent from the Routes tab edits it in this dialog, as switching the depth does', async () => {
    const stored = {
      '/_/pages/uuid-self': { '@id': '/_/pages/uuid-self', 'reference': 'Child', 'parentPage': '/_/pages/parent' },
      '/_/pages/parent': { '@id': '/_/pages/parent', 'reference': 'Parent' },
    }
    const { wrapper } = setup({ stored })
    const endpoint = mockUseItemPage.mock.calls[0]![0].endpoint
    confirmDiscard.mockResolvedValueOnce(true)

    await routesTab(wrapper).vm.$emit('openPage', '/_/pages/parent')
    await flushPromises()

    expect(confirmDiscard).toHaveBeenCalledOnce()
    expect(endpoint.value).toBe('/_/pages/parent')
    expect(mockNavigateTo).not.toHaveBeenCalled()
  })

  test('opening a child page from the Routes tab closes this dialog, then opens its own settings past the editing guard', async () => {
    const { wrapper } = setup()
    requestClose.mockResolvedValueOnce(false)
    await routesTab(wrapper).vm.$emit('openPage', '/_/pages/child')
    await flushPromises()
    expect(mockNavigateTo).not.toHaveBeenCalled()

    requestClose.mockResolvedValueOnce(true)
    await routesTab(wrapper).vm.$emit('openPage', '/_/pages/child')
    await flushPromises()
    expect(requestClose).toHaveBeenCalledTimes(2)
    expect(confirmDiscard).not.toHaveBeenCalled()
    expect(mockNavigateTo).toHaveBeenCalledWith({ name: '_cwa-routes-iri', params: { iri: '/_/pages/child' }, query: { cwa_force: 'true' } })
  })

  test('going to a child route closes the dialog and navigates past the editing guard', async () => {
    const { wrapper } = setup()
    requestClose.mockResolvedValueOnce(false)
    await routesTab(wrapper).vm.$emit('goTo', '/conference/day-1')
    await flushPromises()
    expect(mockNavigateTo).not.toHaveBeenCalled()

    requestClose.mockResolvedValueOnce(true)
    await routesTab(wrapper).vm.$emit('goTo', '/conference/day-1')
    await flushPromises()
    expect(mockNavigateTo).toHaveBeenCalledWith({ path: '/conference/day-1', query: { cwa_force: 'true' } })
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

    expect(countsMock).toHaveBeenCalledWith(expect.anything(), '/_/pages/uuid-self', expect.any(Promise))
    expect(await countsMock.mock.calls[0]![2]).toEqual(['/page_data/blog_article_datas'])
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

  test('the confirm names the other admins editing the page (#429)', async () => {
    realtime.peers.mockReturnValueOnce([
      { user: { id: '/users/sam', name: 'Sam' }, name: 'Sam', state: 'editing', idle: false },
      { user: { id: '/users/jo', name: 'Jo' }, name: 'Jo', state: 'selected', idle: true },
    ])
    const { wrapper } = setup()
    confirmMock.mockResolvedValueOnce(false)

    await clickDelete(wrapper)

    expect(realtime.peers).toHaveBeenCalledWith('/_/pages/uuid-self')
    expect(confirmMock.mock.calls[0]![0].lines).toEqual([
      { text: 'Sam is editing this.' },
      { text: 'This can\'t be undone.' },
    ])
  })

  test('the count check starts at once, so the API docs it waits for are inside its 3 s limit (§8.6)', async () => {
    countsMock.mockResolvedValueOnce({})
    const { wrapper } = setup({ resource: { '@id': '/_/pages/uuid-self', '@type': 'Page', 'reference': 'T', 'isTemplate': true }, apiDocumentation: new Promise(() => {}) })
    confirmMock.mockResolvedValueOnce(false)

    await clickDelete(wrapper)

    expect(countsMock).toHaveBeenCalledWith(expect.anything(), '/_/pages/uuid-self', expect.any(Promise))
    expect(confirmMock).toHaveBeenCalledOnce()
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
    const category = field(wrapper, Select, 'Category')
    expect(category.props()).toMatchObject({ options: [{ label: 'A', value: '0' }, { label: 'None', value: null }], nullable: true })
    expect(category.props('model')).toMatchObject({ field: 'category' })
    expect(category.props('model').model.value).toBe('0')
    expect(field(wrapper, Select, 'Status').props('model').field).toBe('status')
    expect(wrapper.get('[data-cwa-field="subtitle"] input').element).toHaveProperty('value', 'Hello')
  })

  test('a meta select shows and stores its options\' own values, so a number or a boolean is saved as one', () => {
    const { wrapper, form } = setupPageData({
      pageDataConfig: {
        metaFields: [{ field: 'priority', type: 'select', label: 'Priority', options: [{ label: 'One', value: 1 }, { label: 'Text one', value: '1' }, { label: 'Yes', value: true }, { label: 'None', value: null }] }],
      },
      local: { priority: 1 },
    })
    form.discard()
    const priority = field(wrapper, Select, 'Priority')
    const keyOf = (label: string) => priority.props('options').find((option: { label: string }) => option.label === label).value

    expect(priority.props('model').model.value).toBe(keyOf('One'))

    priority.props('model').model.value = keyOf('Yes')
    expect(form.local.priority).toBe(true)
    priority.props('model').model.value = keyOf('Text one')
    expect(form.local.priority).toBe('1')
    expect(priority.props('model').model.value).toBe(keyOf('Text one'))
    priority.props('model').model.value = keyOf('One')
    expect(form.local.priority).toBe(1)
    expect(form.unsavedFields).toEqual([])
    priority.props('model').model.value = null
    expect(form.local.priority).toBeNull()
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

describe('PageResourceAdminModal Style select', () => {
  const pagesConfig = { PrimaryPageTemplate: { name: 'Primary', classes: { Wide: ['is-wide', 'cwa-pad'], Dark: 'is-dark' } } }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('lists the configured styles by name and shows the one the stored class list holds', () => {
    const { wrapper } = setup({ pagesConfig, local: { uiComponent: 'CwaPagePrimaryPageTemplate', uiClassNames: ['is-wide cwa-pad'] } })
    const style = field(wrapper, Select, 'Style')

    expect(style.props('options')).toEqual([{ label: 'Wide', value: 'Wide' }, { label: 'Dark', value: 'Dark' }])
    expect(style.props('model').field).toBe('uiClassNames')
    expect(style.props('model').model.value).toBe('Wide')
  })

  test('choosing a style stores its classes as the one class string in the list, and Default clears it', () => {
    const { wrapper, form } = setup({ pagesConfig, local: { uiComponent: 'CwaPagePrimaryPageTemplate', uiClassNames: ['is-wide cwa-pad'] } })
    form.discard()
    const model = field(wrapper, Select, 'Style').props('model')

    model.model.value = 'Dark'
    expect(form.local.uiClassNames).toEqual(['is-dark'])
    expect(form.unsavedFields).toEqual(['uiClassNames'])

    model.model.value = 'Wide'
    expect(form.local.uiClassNames).toEqual(['is-wide cwa-pad'])
    expect(form.unsavedFields).toEqual([])

    model.model.value = null
    expect(form.local.uiClassNames).toBeNull()
  })

  test('a stored class list that matches no configured style shows Default', () => {
    const { wrapper } = setup({ pagesConfig, local: { uiComponent: 'CwaPagePrimaryPageTemplate', uiClassNames: ['something-else'] } })

    expect(field(wrapper, Select, 'Style').props('model').model.value).toBeNull()
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

describe('PageResourceAdminModal creating from a list (#461)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('a new page is titled as new, and Save becomes "+ Page"', () => {
    const { wrapper } = setup({ routeIri: 'add', isAdding: true })
    const dialog = wrapper.findComponent(DialogStub)

    expect(dialog.props('title')).toBe('New page')
    expect(dialog.props('createNoun')).toBe('page')
    expect(wrapper.find('[data-testid="page-view-on-site"]').exists()).toBe(false)
  })

  test('editing passes no create noun, so Save counts changes', () => {
    const { wrapper } = setup()

    expect(wrapper.findComponent(DialogStub).props('createNoun')).toBeUndefined()
  })

  test('a new page posts to the pages collection, starts static with the first page UI, and takes the first layout once layouts load', async () => {
    const { localResourceData } = setup({
      routeIri: 'add',
      isAdding: true,
      resourceType: 'Page',
      local: { layout: undefined },
      layouts: [{ '@id': '/_/layouts/first', 'reference': 'First' }, { '@id': '/_/layouts/second', 'reference': 'Second' }],
    })
    const options = mockUseItemPage.mock.calls[0]![0]

    expect(options.createEndpoint.value).toBe('/_/pages')
    expect(options.defaultResource()).toEqual({ isTemplate: false, uiComponent: componentNames.filter(name => name.startsWith('CwaPage'))[0] })
    await flushPromises()
    expect(localResourceData.value.layout).toBe('/_/layouts/first')
    expect(options.defaultResource()).toEqual({ isTemplate: false, uiComponent: componentNames.filter(name => name.startsWith('CwaPage'))[0], layout: '/_/layouts/first' })
  })

  test('the layouts offered are every page of the collection, not the first the API answers with', async () => {
    const { wrapper } = setup({
      routeIri: 'add',
      isAdding: true,
      fetchData: path => path === '/_/layouts?perPage=100'
        ? { member: [{ '@id': '/_/layouts/a', 'reference': 'A' }], view: { next: '/_/layouts?perPage=100&page=2' } }
        : { member: [{ '@id': '/_/layouts/b', 'reference': 'B' }] },
    })
    await flushPromises()

    expect(field(wrapper, Select, 'Layout').props('options')).toEqual([{ label: 'A', value: '/_/layouts/a' }, { label: 'B', value: '/_/layouts/b' }])
  })

  test('a loader that fails is logged and the others still load, so the first layout is still chosen', async () => {
    const error = vi.spyOn(consola, 'error').mockImplementation(() => undefined)
    const { localResourceData } = setup({
      routeIri: 'add',
      isAdding: true,
      local: { layout: undefined },
      layouts: [{ '@id': '/_/layouts/first', 'reference': 'First' }],
      loadParentPageOptions: () => Promise.reject(new Error('offline')),
      loadDynamicPageOptions: () => Promise.reject(new Error('offline')),
    })
    await flushPromises()

    expect(localResourceData.value.layout).toBe('/_/layouts/first')
    expect(error).toHaveBeenCalledWith('[CWA] Could not load the parent pages', expect.any(Error))
    expect(error).toHaveBeenCalledWith('[CWA] Could not load the template pages', expect.any(Error))
    expect(mockUseParentPageDataLoader.mock.results[0]!.value.loadDataTypes).toHaveBeenCalled()
  })

  test.each([
    ['a page with no layouts', { layouts: [] }, 'Create a layout first', 'Create a layout', { name: '_cwa-layouts-iri', params: { iri: 'add' }, query: { cwa_force: 'true' } }],
    ['a page data with no template pages', { resourceType: 'BlogArticleData', dynamicPages: [] }, 'Create a template page first', 'Create a template page', { name: '_cwa-pages-iri', params: { iri: 'add' }, query: { cwa_force: 'true' } }],
  ])('creating %s shows what to create first in place of the form, and goes there once the dialog closes', async (_kind, opts, title, action, to) => {
    const { wrapper } = setup({ routeIri: 'add', isAdding: true, attach: true, ...opts })
    await flushPromises()

    const alert = wrapper.get('[data-testid="page-missing-prerequisite"]')
    expect(alert.text()).toContain(title)
    expect(wrapper.findAllComponents(Input)).toHaveLength(0)
    const link = wrapper.get('[data-testid="page-missing-prerequisite-link"]')
    expect(link.text()).toBe(action)
    expect(drawsFocusRing(link.classes())).toBe(true)
    expect(await axe(wrapper.element as HTMLElement)).toHaveNoViolations()

    requestClose.mockResolvedValueOnce(false)
    await link.trigger('click')
    await flushPromises()
    expect(mockNavigateTo).not.toHaveBeenCalled()

    requestClose.mockResolvedValueOnce(true)
    await link.trigger('click')
    await flushPromises()
    expect(mockNavigateTo).toHaveBeenCalledWith(to)
  })

  test('an existing page is never asked to create a layout first', async () => {
    const { wrapper } = setup({ layouts: [] })
    await flushPromises()

    expect(wrapper.find('[data-testid="page-missing-prerequisite"]').exists()).toBe(false)
  })

  test('Go to dynamic template carries the eye, and page data with no template says so instead', () => {
    const chosen = setupPageData({ local: { page: '/_/pages/template' } }).wrapper
    expect(chosen.getComponent('[data-testid="go-to-template"]').props('icon')).toBe(EyeGlyph)
    expect(chosen.find('[data-testid="no-template"]').exists()).toBe(false)

    const none = setupPageData({ local: { page: null } }).wrapper
    expect(none.find('[data-testid="go-to-template"]').exists()).toBe(false)
    expect(none.get('[data-testid="no-template"]').text()).toBe('No template selected')
  })

  test('going to the template asks the dialog to close first, so unsaved input is never dropped without asking', async () => {
    const { wrapper } = setupPageData({ local: { page: '/_/pages/template' } })
    const button = wrapper.get('[data-testid="go-to-template"]')

    requestClose.mockResolvedValueOnce(false)
    await button.trigger('click')
    await flushPromises()
    expect(requestClose).toHaveBeenCalledOnce()
    expect(mockNavigateTo).not.toHaveBeenCalled()
    expect(wrapper.emitted('close')).toBeUndefined()

    requestClose.mockResolvedValueOnce(true)
    await button.trigger('click')
    await flushPromises()
    expect(mockNavigateTo).toHaveBeenCalledWith({ name: '_cwa-resource-page', params: { cwaPage0: '/_/pages/template' }, query: { cwa_force: 'true' } })
  })

  test('a new page data takes its parents and template from the link, never the list\'s page number (#390), with its concrete class as its type (#393)', () => {
    setup({
      routeIri: 'add',
      isAdding: true,
      resourceType: 'BlogArticleData',
      query: { parentPage: '/_/pages/parent', parentPageData: '/page_data/parent', template: '/_/pages/template', page: '2' },
    })
    const options = mockUseItemPage.mock.calls[0]![0]

    expect(options.resourceType).toBe('BlogArticleData')
    expect(options.defaultResource()).toEqual({ parentPage: '/_/pages/parent', parentPageData: '/page_data/parent', page: '/_/pages/template' })
  })

  test('a new page data posts to its own collection from the API docs, and is named from its class, never its configured list title', async () => {
    const { wrapper } = setup({
      routeIri: 'add',
      isAdding: true,
      resourceType: 'BlogArticleData',
      pageDataTypes: { BlogArticleData: { name: 'Blog Articles' } },
    })
    await flushPromises()

    expect(mockUseItemPage.mock.calls[0]![0].createEndpoint.value).toBe('/page_data/blog_article_datas')
    expect(wrapper.findComponent(DialogStub).props('title')).toBe('New blog article')
    expect(wrapper.findComponent(DialogStub).props('createNoun')).toBe('blog article')
  })

  test('an unconfigured page data type is named from its class', () => {
    const { wrapper } = setup({ routeIri: 'add', isAdding: true, resourceType: 'EventData' })

    expect(wrapper.findComponent(DialogStub).props('createNoun')).toBe('event')
  })

  test('a new page data without a template in its link takes the first template', async () => {
    const { localResourceData } = setup({
      routeIri: 'add',
      isAdding: true,
      resourceType: 'BlogArticleData',
      dynamicPages: [{ '@id': '/_/pages/template-a', 'reference': 'A' }, { '@id': '/_/pages/template-b', 'reference': 'B' }],
    })
    await flushPromises()

    expect(localResourceData.value.page).toBe('/_/pages/template-a')
    expect(mockUseItemPage.mock.calls[0]![0].defaultResource()).toEqual({ page: '/_/pages/template-a' })
  })

  test('a template given by the link is kept', async () => {
    const { localResourceData } = setup({
      routeIri: 'add',
      isAdding: true,
      resourceType: 'BlogArticleData',
      local: { page: '/_/pages/template-b' },
      dynamicPages: [{ '@id': '/_/pages/template-a', 'reference': 'A' }, { '@id': '/_/pages/template-b', 'reference': 'B' }],
    })
    await flushPromises()

    expect(localResourceData.value.page).toBe('/_/pages/template-b')
  })

  test('after Create the dialog edits the new page, on the tab its link names', async () => {
    const { wrapper, handlers } = setup({ routeIri: 'add', isAdding: true })
    const options = mockUseItemPage.mock.calls[0]![0]

    handlers.isAdding.value = false
    routeState.route.params = { iri: '/_/pages/new' }
    routeState.route.hash = '#routes'
    await flushPromises()

    expect(options.endpoint.value).toBe('/_/pages/new')
    expect(wrapper.findComponent(DialogStub).props('tab')).toBe('routes')
  })

  test('a link to a page\'s Routes tab opens it there, and a hash naming no tab opens Details', () => {
    expect(setup({ hash: '#routes' }).wrapper.findComponent(DialogStub).props('tab')).toBe('routes')
    expect(setup({ hash: '#data' }).wrapper.findComponent(DialogStub).props('tab')).toBe('details')
  })

  test('after Create a static page opens on Routes and a template stays on Details', () => {
    const { localResourceData } = setup({ routeIri: 'add', isAdding: true })
    const hash = mockUseItemPage.mock.calls[0]![0].routeHashAfterAdd

    expect(hash.value).toBe('#routes')
    localResourceData.value.isTemplate = true
    expect(hash.value).toBe('#details')
  })
})
