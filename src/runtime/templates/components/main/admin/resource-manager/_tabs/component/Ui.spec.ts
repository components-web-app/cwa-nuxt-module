// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { computed, nextTick, reactive, ref } from 'vue'
import { axe } from '../../../../../../../../../test/utils/axe'
import Select from '#cwa/templates/components/ui/Select.vue'
import MultiSelect from '#cwa/templates/components/ui/MultiSelect.vue'
import Ui from './Ui.vue'

enableAutoUnmount(afterEach)

const store = vi.hoisted(() => ({ byId: {} as Record<string, any> }))
const iri = ref('/component/1')
const currentStackItem = ref<any>(null)
const exposeMeta = { disabled: ref(false), fields: [] as string[] }
const mockUpdateResource = vi.fn()

const mockCwa = {
  resources: { getResource: (at: string) => computed(() => store.byId[at]) },
  resourcesManager: {
    getWaitForRequestPromise: vi.fn().mockResolvedValue(undefined),
    updateResource: mockUpdateResource,
    registerPendingUpdate: vi.fn(() => () => {}),
  },
  admin: { isEditing: true, resourceStackManager: { currentStackItem, currentIri: iri, forcePublishedVersion: ref(undefined) } },
}

vi.mock('#cwa/composables/cwa', () => ({ useCwa: () => mockCwa }))

vi.mock('#cwa/composables/cwa-resource-manager-tab', () => ({
  useCwaResourceManagerTab: () => ({
    iri,
    $cwa: mockCwa,
    exposeMeta,
  }),
}))

vi.mock('#cwa/resources/realtime-view', () => ({ realtimeView: () => ({ view: { value: undefined }, load: vi.fn().mockResolvedValue(undefined) }) }))

const resolvedMeta = vi.hoisted(() => ({ value: [] as any[] }))
vi.mock('#cwa/templates/components/core/useDataResolver', () => ({
  useDataResolver: (meta: { value: unknown[] }) => ({
    startDataResolver: () => {
      meta.value = resolvedMeta.value
    },
  }),
}))

function setStyles(multiple: boolean, ui: string[] = []) {
  currentStackItem.value = {
    ui,
    styles: { value: { multiple, classes: {
      Bordered: 'border border-gray-200',
      Rounded: 'rounded',
    } } },
  }
}

function put(at: string, data: Record<string, unknown>) {
  store.byId[at] = reactive({ data: { '@id': at, 'uiComponent': null, 'uiClassNames': null, ...data }, apiState: {} })
}

function answering(answer: (event: any) => { resource?: any, error?: unknown }) {
  mockUpdateResource.mockImplementation(async (event: any) => {
    const outcome = answer(event)
    event.onRequest?.(event.endpoint, Promise.resolve(outcome))
    return outcome.resource
  })
}

function saveInPlace(event: { endpoint: string, data: Record<string, unknown> }) {
  Object.assign(store.byId[event.endpoint].data, event.data)
  return { resource: store.byId[event.endpoint].data }
}

async function saves() {
  await nextTick()
  await new Promise(resolve => setTimeout(resolve, 5))
  await flushPromises()
}

function modelOf(component: { props: (name: string) => unknown }) {
  return component.props('model') as { model: { value: unknown } }
}

function mountUi() {
  return mount(Ui, { attachTo: document.body })
}

beforeEach(() => {
  store.byId = {}
  iri.value = '/component/1'
  put('/component/1', {})
  resolvedMeta.value = []
  exposeMeta.fields.length = 0
  mockUpdateResource.mockReset()
  answering(saveInPlace)
})

describe('Ui tab on the kit (#460)', () => {
  test('is one manager-tab row whose fields are named for the tab badges', () => {
    setStyles(false)
    const wrapper = mountUi()

    expect(wrapper.find('[data-testid="manager-tab"]').exists()).toBe(true)
    expect(exposeMeta.fields).toEqual(['uiComponent', 'uiClassNames'])
  })

  test('offers the UI choices with Default first, named once their metadata resolves, and only when the component has any', async () => {
    setStyles(false, ['CwaComponentSplit'])
    resolvedMeta.value = [{ cwaResource: { name: 'Split image' } }]
    const wrapper = mountUi()
    await nextTick()

    const select = wrapper.getComponent(Select)
    expect(select.props('label')).toBe('UI')
    expect(select.props('noneLabel')).toBe('Default')
    expect(select.props('options')).toEqual([{ label: 'Split image', value: 'CwaComponentSplit' }])

    currentStackItem.value = { ui: ['CwaComponentSplit', 'CwaComponentWide'], styles: undefined }
    resolvedMeta.value = new Array(2)
    resolvedMeta.value[1] = { cwaResource: { name: 'Wide' } }
    const resolving = mountUi()
    await nextTick()
    expect(resolving.getComponent(Select).props('options')).toEqual([
      { label: 'CwaComponentSplit', value: 'CwaComponentSplit' },
      { label: 'Wide', value: 'CwaComponentWide' },
    ])

    currentStackItem.value = { ui: [], styles: undefined }
    resolvedMeta.value = []
    const plain = mountUi()
    expect(plain.findComponent(Select).exists()).toBe(false)
  })

  test('choosing another UI sends it and clears the styles in the same request', async () => {
    setStyles(false, ['CwaComponentSplit'])
    resolvedMeta.value = [{ cwaResource: { name: 'Split image' } }]
    put('/component/1', { uiClassNames: ['rounded'] })
    const wrapper = mountUi()
    await nextTick()

    modelOf(wrapper.getComponent(Select)).model.value = 'CwaComponentSplit'
    await saves()

    expect(mockUpdateResource).toHaveBeenCalledTimes(1)
    expect(mockUpdateResource).toHaveBeenCalledWith(expect.objectContaining({ endpoint: '/component/1', data: { uiComponent: 'CwaComponentSplit', uiClassNames: null } }))
  })

  test('choosing another UI with no styles chosen sends only the UI', async () => {
    setStyles(false, ['CwaComponentSplit'])
    const wrapper = mountUi()
    await nextTick()

    modelOf(wrapper.getComponent(Select)).model.value = 'CwaComponentSplit'
    await saves()

    expect(mockUpdateResource).toHaveBeenCalledWith(expect.objectContaining({ data: { uiComponent: 'CwaComponentSplit' } }))
  })

  test.each([
    ['failed', () => answering(() => ({ error: { statusCode: 500 } })), 'CwaComponentSplit', ['rounded']],
    ['skipped', () => {}, 'CwaComponentWide', null],
  ])('a %s UI save never later nulls another resource\'s styles', async (_kind, arrange, picked, styles) => {
    setStyles(false, ['CwaComponentSplit', 'CwaComponentWide'])
    put('/component/1', { uiComponent: 'CwaComponentWide', uiClassNames: styles })
    put('/component/2', { uiComponent: 'CwaComponentSplit', uiClassNames: ['border border-gray-200'] })
    arrange()
    const wrapper = mountUi()
    await nextTick()

    modelOf(wrapper.getComponent(Select)).model.value = picked
    await saves()
    iri.value = '/component/2'
    await saves()
    store.byId['/component/1'].data.uiComponent = 'CwaComponentSplit'
    await saves()

    expect(mockUpdateResource).not.toHaveBeenCalledWith(expect.objectContaining({ endpoint: '/component/2' }))
    expect(store.byId['/component/2'].data.uiClassNames).toEqual(['border border-gray-200'])
  })

  describe('multiple styles, through a typed mapping from class strings to style names', () => {
    beforeEach(() => setStyles(true))

    test('a multi-select of style names shows the stored classes as names', () => {
      put('/component/1', { uiClassNames: ['rounded'] })
      const wrapper = mountUi()
      const multi = wrapper.getComponent(MultiSelect)

      expect(multi.props('options')).toEqual([
        { label: 'Bordered', value: 'Bordered' },
        { label: 'Rounded', value: 'Rounded' },
      ])
      expect(modelOf(multi).model.value).toEqual(['Rounded'])
      expect(wrapper.get('[data-testid="multi-chip"]').text()).toContain('Rounded')
    })

    test('choosing styles saves one class string per style, and none saves null', async () => {
      put('/component/1', { uiClassNames: ['rounded'] })
      const wrapper = mountUi()
      const model = modelOf(wrapper.getComponent(MultiSelect))

      model.model.value = ['Bordered', 'Rounded']
      await saves()
      expect(mockUpdateResource).toHaveBeenLastCalledWith(expect.objectContaining({ data: { uiClassNames: ['border border-gray-200', 'rounded'] } }))
      expect(model.model.value).toEqual(['Bordered', 'Rounded'])

      model.model.value = []
      await saves()
      expect(mockUpdateResource).toHaveBeenLastCalledWith(expect.objectContaining({ data: { uiClassNames: null } }))
      expect(model.model.value).toEqual([])
    })
  })

  describe('a single style', () => {
    beforeEach(() => setStyles(false))

    test('a nullable select of style names, with Default for none', () => {
      put('/component/1', { uiClassNames: ['border border-gray-200'] })
      const wrapper = mountUi()
      const select = wrapper.getComponent(Select)

      expect(select.props('label')).toBe('Style')
      expect(select.props('noneLabel')).toBe('Default')
      expect(modelOf(select).model.value).toBe('Bordered')
      expect(wrapper.get('[data-testid="select-trigger"]').text()).toBe('Bordered')
    })

    test('choosing one saves a one-element uiClassNames, and Default saves null', async () => {
      const wrapper = mountUi()
      const model = modelOf(wrapper.getComponent(Select))

      model.model.value = 'Rounded'
      await saves()
      expect(mockUpdateResource).toHaveBeenLastCalledWith(expect.objectContaining({ data: { uiClassNames: ['rounded'] } }))

      model.model.value = null
      await saves()
      expect(mockUpdateResource).toHaveBeenLastCalledWith(expect.objectContaining({ data: { uiClassNames: null } }))
      expect(wrapper.get('[data-testid="select-trigger"]').text()).toBe('Default')
    })
  })

  test('has no axe violations', async () => {
    setStyles(true, ['CwaComponentSplit'])
    resolvedMeta.value = [{ cwaResource: { name: 'Split image' } }]
    put('/component/1', { uiClassNames: ['rounded', 'border border-gray-200'] })
    const wrapper = mountUi()
    await nextTick()

    expect(await axe(wrapper.element as HTMLElement)).toHaveNoViolations()
  })
})
