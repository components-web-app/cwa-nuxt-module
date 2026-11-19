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

const config = vi.hoisted(() => ({
  resourcesConfig: {} as Record<string, any>,
  uiConfig: {} as Record<string, any>,
}))

vi.mock('#build/cwa-config', () => config)

vi.mock('#cwa/composables/cwa', () => ({ useCwa: () => mockCwa }))

vi.mock('#cwa/composables/cwa-resource-manager-tab', () => ({
  useCwaResourceManagerTab: () => ({
    iri,
    $cwa: mockCwa,
    exposeMeta,
  }),
}))

vi.mock('#cwa/resources/realtime-view', () => ({ realtimeView: () => ({ view: { value: undefined }, load: vi.fn().mockResolvedValue(undefined) }) }))

function setStyles(multipleStyles: boolean, ui: string[] = []) {
  currentStackItem.value = { ui }
  config.resourcesConfig = {
    Hero: {
      multipleStyles,
      styles: {
        bordered: { label: 'Bordered', classes: 'border border-gray-200' },
        rounded: { label: 'Rounded', classes: 'rounded' },
      },
    },
  }
  config.uiConfig = {
    CwaComponentHeroUiTall: {
      styles: { tall: { label: 'Tall', classes: 'h-screen' } },
    },
    CwaComponentHeroUiSplit: {},
  }
}

function put(at: string, data: Record<string, unknown>) {
  store.byId[at] = reactive({ data: { '@id': at, '@type': 'Hero', 'uiComponent': null, 'uiClassNames': null, ...data }, apiState: {} })
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
  config.resourcesConfig = {}
  config.uiConfig = {}
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

  test('offers the UI choices with Default first, named from their defineCwaConfig, and only when the component has any (#453)', () => {
    setStyles(false, ['CwaComponentHeroUiTall', 'CwaComponentHeroUiSplit'])
    config.uiConfig.CwaComponentHeroUiTall.name = 'Tall hero'
    const wrapper = mountUi()

    const select = wrapper.findAllComponents(Select).at(0)!
    expect(select.props('label')).toBe('UI')
    expect(select.props('noneLabel')).toBe('Default')
    expect(select.props('options')).toEqual([
      { label: 'Tall hero', value: 'CwaComponentHeroUiTall' },
      { label: 'CwaComponentHeroUiSplit', value: 'CwaComponentHeroUiSplit' },
    ])

    currentStackItem.value = { ui: [] }
    config.resourcesConfig = {}
    const plain = mountUi()
    expect(plain.findComponent(Select).exists()).toBe(false)
  })

  test('the tab mounts no component to find out its styles: the stack item carries none, and the options still show (#453)', () => {
    setStyles(false)
    const wrapper = mountUi()

    expect(currentStackItem.value.styles).toBeUndefined()
    expect(wrapper.getComponent(Select).props('options')).toEqual([
      { label: 'Bordered', value: 'bordered' },
      { label: 'Rounded', value: 'rounded' },
    ])
  })

  test('choosing another UI keeps the stored keys the new variant defines and drops the rest, in the same request (#453)', async () => {
    setStyles(false, ['CwaComponentHeroUiTall'])
    config.uiConfig.CwaComponentHeroUiTall.styles.bordered = { label: 'Bordered', classes: 'border-4' }
    put('/component/1', { uiClassNames: ['style:bordered', 'style:rounded', 'legacy classes'] })
    const wrapper = mountUi()

    modelOf(wrapper.findAllComponents(Select).at(0)!).model.value = 'CwaComponentHeroUiTall'
    await saves()

    expect(mockUpdateResource).toHaveBeenCalledTimes(1)
    expect(mockUpdateResource).toHaveBeenCalledWith(expect.objectContaining({ endpoint: '/component/1', data: { uiComponent: 'CwaComponentHeroUiTall', uiClassNames: ['style:bordered'] } }))
  })

  test('choosing a UI that defines none of the stored keys stores null with it (#453)', async () => {
    setStyles(false, ['CwaComponentHeroUiTall'])
    put('/component/1', { uiClassNames: ['style:rounded'] })
    const wrapper = mountUi()

    modelOf(wrapper.findAllComponents(Select).at(0)!).model.value = 'CwaComponentHeroUiTall'
    await saves()

    expect(mockUpdateResource).toHaveBeenCalledWith(expect.objectContaining({ data: { uiComponent: 'CwaComponentHeroUiTall', uiClassNames: null } }))
  })

  test('choosing another UI that defines every stored key sends only the UI (#453)', async () => {
    setStyles(false, ['CwaComponentHeroUiSplit'])
    put('/component/1', { uiComponent: 'CwaComponentHeroUiTall', uiClassNames: ['style:tall'] })
    config.uiConfig.CwaComponentHeroUiSplit = { styles: { tall: { label: 'Tall', classes: 'h-dvh' } } }
    currentStackItem.value = { ui: ['CwaComponentHeroUiTall', 'CwaComponentHeroUiSplit'] }
    const wrapper = mountUi()

    modelOf(wrapper.findAllComponents(Select).at(0)!).model.value = 'CwaComponentHeroUiSplit'
    await saves()

    expect(mockUpdateResource).toHaveBeenCalledWith(expect.objectContaining({ data: { uiComponent: 'CwaComponentHeroUiSplit' } }))
  })

  test('choosing another UI with no styles chosen sends only the UI', async () => {
    setStyles(false, ['CwaComponentHeroUiSplit'])
    const wrapper = mountUi()

    modelOf(wrapper.findAllComponents(Select).at(0)!).model.value = 'CwaComponentHeroUiSplit'
    await saves()

    expect(mockUpdateResource).toHaveBeenCalledWith(expect.objectContaining({ data: { uiComponent: 'CwaComponentHeroUiSplit' } }))
  })

  test.each([
    ['failed', () => answering(() => ({ error: { statusCode: 500 } })), 'CwaComponentHeroUiSplit', ['style:rounded']],
    ['skipped', () => {}, 'CwaComponentHeroUiTall', null],
  ])('a %s UI save never later rewrites another resource\'s styles', async (_kind, arrange, picked, styles) => {
    setStyles(false, ['CwaComponentHeroUiSplit', 'CwaComponentHeroUiTall'])
    put('/component/1', { uiComponent: 'CwaComponentHeroUiTall', uiClassNames: styles })
    put('/component/2', { uiComponent: 'CwaComponentHeroUiSplit', uiClassNames: ['style:bordered'] })
    arrange()
    const wrapper = mountUi()

    modelOf(wrapper.findAllComponents(Select).at(0)!).model.value = picked
    await saves()
    iri.value = '/component/2'
    await saves()
    store.byId['/component/1'].data.uiComponent = 'CwaComponentHeroUiSplit'
    await saves()

    expect(mockUpdateResource).not.toHaveBeenCalledWith(expect.objectContaining({ endpoint: '/component/2' }))
    expect(store.byId['/component/2'].data.uiClassNames).toEqual(['style:bordered'])
  })

  describe('a UI variant\'s styles (#453)', () => {
    beforeEach(() => setStyles(false, ['CwaComponentHeroUiTall']))

    test('a UI variant offers its own styles', () => {
      put('/component/1', { uiComponent: 'CwaComponentHeroUiTall' })
      const wrapper = mountUi()

      expect(wrapper.findAllComponents(Select).at(-1)!.props('options')).toEqual([{ label: 'Tall', value: 'tall' }])
    })

    test('a key the variant does not know shows no style selected, and choosing one keeps the other key', async () => {
      put('/component/1', { uiComponent: 'CwaComponentHeroUiTall', uiClassNames: ['style:bordered'] })
      const wrapper = mountUi()
      const model = modelOf(wrapper.findAllComponents(Select).at(-1)!)
      expect(model.model.value).toBeNull()

      model.model.value = 'tall'
      await saves()
      expect(mockUpdateResource).toHaveBeenLastCalledWith(expect.objectContaining({ data: { uiClassNames: ['style:bordered', 'style:tall'] } }))
    })
  })

  describe('multiple styles, through a typed mapping from stored keys to style keys', () => {
    beforeEach(() => setStyles(true))

    test('a multi-select of style labels shows the stored keys as their labels', () => {
      put('/component/1', { uiClassNames: ['style:rounded'] })
      const wrapper = mountUi()
      const multi = wrapper.getComponent(MultiSelect)

      expect(multi.props('options')).toEqual([
        { label: 'Bordered', value: 'bordered' },
        { label: 'Rounded', value: 'rounded' },
      ])
      expect(modelOf(multi).model.value).toEqual(['rounded'])
      expect(wrapper.get('[data-testid="multi-chip"]').text()).toContain('Rounded')
    })

    test('choosing styles saves each key as style:<key>, and none saves null', async () => {
      put('/component/1', { uiClassNames: ['style:rounded'] })
      const wrapper = mountUi()
      const model = modelOf(wrapper.getComponent(MultiSelect))

      model.model.value = ['bordered', 'rounded']
      await saves()
      expect(mockUpdateResource).toHaveBeenLastCalledWith(expect.objectContaining({ data: { uiClassNames: ['style:bordered', 'style:rounded'] } }))
      expect(model.model.value).toEqual(['bordered', 'rounded'])

      model.model.value = []
      await saves()
      expect(mockUpdateResource).toHaveBeenLastCalledWith(expect.objectContaining({ data: { uiClassNames: null } }))
      expect(model.model.value).toEqual([])
    })
  })

  describe('a single style', () => {
    beforeEach(() => setStyles(false))

    test('a nullable select of style labels, with Default for none', () => {
      put('/component/1', { uiClassNames: ['style:bordered'] })
      const wrapper = mountUi()
      const select = wrapper.getComponent(Select)

      expect(select.props('label')).toBe('Style')
      expect(select.props('noneLabel')).toBe('Default')
      expect(modelOf(select).model.value).toBe('bordered')
      expect(wrapper.get('[data-testid="select-trigger"]').text()).toBe('Bordered')
    })

    test('choosing one saves style:<key>, and Default saves null', async () => {
      const wrapper = mountUi()
      const model = modelOf(wrapper.getComponent(Select))

      model.model.value = 'rounded'
      await saves()
      expect(mockUpdateResource).toHaveBeenLastCalledWith(expect.objectContaining({ data: { uiClassNames: ['style:rounded'] } }))

      model.model.value = null
      await saves()
      expect(mockUpdateResource).toHaveBeenLastCalledWith(expect.objectContaining({ data: { uiClassNames: null } }))
      expect(wrapper.get('[data-testid="select-trigger"]').text()).toBe('Default')
    })
  })

  test('has no axe violations', async () => {
    setStyles(true, ['CwaComponentHeroUiSplit'])
    config.uiConfig.CwaComponentHeroUiSplit.name = 'Split image'
    put('/component/1', { uiClassNames: ['style:rounded', 'style:bordered'] })
    const wrapper = mountUi()
    await nextTick()

    expect(await axe(wrapper.element as HTMLElement)).toHaveNoViolations()
  })
})
