// @vitest-environment happy-dom
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { ref, reactive } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import DataPage from './DataPage.vue'
import * as cwaComposable from '#cwa/composables/cwa'

const CwaUiFormButtonStub = {
  name: 'CwaUiFormButton',
  props: ['disabled'],
  emits: ['click'],
  template: '<button type="button" :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
}

interface SetupOpts {
  // resource at the current iri (the component position resource)
  resourceData?: Record<string, any> | null
  // currentIri value
  iri?: string | null
  // $cwa.resources.pageData computed value
  pageData?: any
  // $cwa.resourcesConfig map
  resourcesConfig?: Record<string, any>
  // getComponentMetadata implementation
  getComponentMetadata?: (...args: any[]) => any
  // resourcesManager mock methods
  initAddResource?: ReturnType<typeof vi.fn>
  setAddResourceEventResource?: ReturnType<typeof vi.fn>
  // event bus emit
  emit?: ReturnType<typeof vi.fn>
}

function setup(opts: SetupOpts = {}, errorHandler?: (...args: any[]) => void) {
  const iriRef = ref<string | null>(opts.iri === undefined ? '/_/component_positions/pos-1' : opts.iri)

  const resourcesStore = reactive<Record<string, any>>({})
  if (iriRef.value) {
    resourcesStore[iriRef.value] = opts.resourceData === undefined
      ? { data: { component: null, _metadata: { staticComponent: null }, pageDataProperty: null } }
      : opts.resourceData
  }

  const getResource = vi.fn((iri: string) => ({
    value: resourcesStore[iri] ?? null,
  }))

  const pageDataRef = ref(opts.pageData ?? null)

  const initAddResource = opts.initAddResource ?? vi.fn().mockResolvedValue(undefined)
  const setAddResourceEventResource = opts.setAddResourceEventResource ?? vi.fn().mockResolvedValue(undefined)
  const emit = opts.emit ?? vi.fn()

  const resourceStack = ref([{ iri: iriRef.value }])

  const $cwa: any = {
    admin: {
      resourceStackManager: {
        currentIri: iriRef,
        resourceStack,
        getState: vi.fn(),
        setState: vi.fn(),
      },
      eventBus: { emit },
    },
    resources: {
      getResource,
      pageData: pageDataRef,
    },
    resourcesConfig: opts.resourcesConfig ?? {},
    resourcesManager: {
      initAddResource,
      setAddResourceEventResource,
    },
    getComponentMetadata: opts.getComponentMetadata ?? vi.fn().mockResolvedValue({}),
  }

  vi.spyOn(cwaComposable, 'useCwa').mockReturnValue($cwa)

  const wrapper = mount(DataPage, {
    global: {
      stubs: {
        CwaUiFormButton: CwaUiFormButtonStub,
      },
      config: errorHandler ? { errorHandler } : {},
    },
  })

  return { wrapper, $cwa, getResource, initAddResource, setAddResourceEventResource, emit, iriRef, resourcesStore }
}

function findButton(wrapper: any) {
  return wrapper.findComponent(CwaUiFormButtonStub)
}

describe('DataPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('hasDynamicComponent -> "Select Component" button', () => {
    test('shows Select Component when a dynamic component is set (no static component)', () => {
      const { wrapper } = setup({
        resourceData: { data: { component: '/component/foo/1', _metadata: { staticComponent: null } } },
      })
      const btn = findButton(wrapper)
      expect(btn.exists()).toBe(true)
      expect(btn.text()).toBe('Select Component')
    })

    test('shows Select Component when component differs from staticComponent', () => {
      const { wrapper } = setup({
        resourceData: { data: { component: '/component/foo/1', _metadata: { staticComponent: '/component/foo/static' } } },
      })
      expect(findButton(wrapper).text()).toBe('Select Component')
    })

    test('does NOT show Select Component when component equals staticComponent', () => {
      const { wrapper } = setup({
        resourceData: { data: { component: '/component/foo/static', _metadata: { staticComponent: '/component/foo/static' }, pageDataProperty: null } },
      })
      // component === staticComponent => hasDynamicComponent false.
      // No pageDataProperty => dynamicComponentName undefined => no button at all.
      expect(findButton(wrapper).exists()).toBe(false)
    })

    test('does NOT show Select Component when there is no component', () => {
      const { wrapper } = setup({
        resourceData: { data: { component: null, _metadata: { staticComponent: null }, pageDataProperty: null } },
      })
      expect(findButton(wrapper).exists()).toBe(false)
    })

    test('clicking Select Component emits selectResource with the component IRI', async () => {
      const { wrapper, emit } = setup({
        resourceData: { data: { component: '/component/foo/1', _metadata: { staticComponent: null } } },
      })
      await findButton(wrapper).trigger('click')
      expect(emit).toHaveBeenCalledWith('selectResource', '/component/foo/1')
    })
  })

  describe('selectComponent guard', () => {
    test('does not emit when there is no component IRI (button hidden, method guarded)', () => {
      const { wrapper, emit } = setup({
        resourceData: { data: { component: null, _metadata: { staticComponent: null }, pageDataProperty: null } },
      })
      expect(findButton(wrapper).exists()).toBe(false)
      expect(emit).not.toHaveBeenCalled()
    })
  })

  describe('dynamicComponentName -> "Add ..." button', () => {
    function pageDataWithProps(props: { property: string, componentShortName: string }[]) {
      return {
        data: {
          _metadata: {
            pageDataMetadata: { properties: props },
          },
        },
      }
    }

    test('shows "Add {resourceConfig.name}" when config name present', () => {
      const { wrapper } = setup({
        resourceData: { data: { component: null, _metadata: { staticComponent: null }, pageDataProperty: 'heroImage' } },
        pageData: pageDataWithProps([{ property: 'heroImage', componentShortName: 'Image' }]),
        resourcesConfig: { Image: { name: 'Hero Image', instantAdd: false } },
      })
      const btn = findButton(wrapper)
      expect(btn.exists()).toBe(true)
      expect(btn.text()).toBe('Add Hero Image')
    })

    test('falls back to componentName when config has no name', () => {
      const { wrapper } = setup({
        resourceData: { data: { component: null, _metadata: { staticComponent: null }, pageDataProperty: 'heroImage' } },
        pageData: pageDataWithProps([{ property: 'heroImage', componentShortName: 'Image' }]),
        resourcesConfig: {},
      })
      expect(findButton(wrapper).text()).toBe('Add Image')
    })

    test('no button when pageDataProperty has no matching property in metadata', () => {
      const { wrapper } = setup({
        resourceData: { data: { component: null, _metadata: { staticComponent: null }, pageDataProperty: 'unknown' } },
        pageData: pageDataWithProps([{ property: 'heroImage', componentShortName: 'Image' }]),
      })
      expect(findButton(wrapper).exists()).toBe(false)
    })

    test('no button when there is no pageData in the store', () => {
      const { wrapper } = setup({
        resourceData: { data: { component: null, _metadata: { staticComponent: null }, pageDataProperty: 'heroImage' } },
        pageData: null,
      })
      expect(findButton(wrapper).exists()).toBe(false)
    })

    test('no button when there is no pageDataProperty', () => {
      const { wrapper } = setup({
        resourceData: { data: { component: null, _metadata: { staticComponent: null }, pageDataProperty: null } },
        pageData: pageDataWithProps([{ property: 'heroImage', componentShortName: 'Image' }]),
      })
      expect(findButton(wrapper).exists()).toBe(false)
    })
  })

  describe('addDynamicComponent flow', () => {
    const baseResource = (pageDataProperty: string | null = 'heroImage') => ({
      data: { component: null, _metadata: { staticComponent: null }, pageDataProperty },
    })
    const pageData = {
      data: { _metadata: { pageDataMetadata: { properties: [{ property: 'heroImage', componentShortName: 'Image' }] } } },
    }

    test('calls initAddResource and setAddResourceEventResource with API metadata', async () => {
      const getComponentMetadata = vi.fn().mockResolvedValue({
        Image: { endpoint: '/_/images', isPublishable: true },
      })
      const { wrapper, initAddResource, setAddResourceEventResource } = setup({
        resourceData: baseResource('heroImage'),
        pageData,
        resourcesConfig: { Image: { name: 'Hero Image', instantAdd: true } },
        getComponentMetadata,
      })
      await findButton(wrapper).trigger('click')
      await flushPromises()

      expect(getComponentMetadata).toHaveBeenCalledWith(false, false)
      expect(initAddResource).toHaveBeenCalledWith(
        '/_/component_positions/pos-1',
        null,
        expect.anything(),
        'heroImage',
      )
      expect(setAddResourceEventResource).toHaveBeenCalledWith('Image', '/_/images', true, true)
    })

    test('passes instantAdd=false when config does not set it', async () => {
      const getComponentMetadata = vi.fn().mockResolvedValue({
        Image: { endpoint: '/_/images', isPublishable: false },
      })
      const { wrapper, setAddResourceEventResource } = setup({
        resourceData: baseResource('heroImage'),
        pageData,
        resourcesConfig: {},
        getComponentMetadata,
      })
      await findButton(wrapper).trigger('click')
      await flushPromises()
      expect(setAddResourceEventResource).toHaveBeenCalledWith('Image', '/_/images', false, false)
    })

    test('disables the button while loading then re-enables it', async () => {
      let resolveMeta: (v: any) => void = () => {}
      const getComponentMetadata = vi.fn().mockImplementation(() => new Promise((res) => {
        resolveMeta = res
      }))
      const { wrapper } = setup({
        resourceData: baseResource('heroImage'),
        pageData,
        resourcesConfig: { Image: { name: 'Hero Image' } },
        getComponentMetadata,
      })
      const btn = findButton(wrapper)
      await btn.trigger('click')
      await flushPromises()
      expect(btn.props('disabled')).toBe(true)
      resolveMeta({ Image: { endpoint: '/_/images', isPublishable: false } })
      await flushPromises()
      expect(findButton(wrapper).props('disabled')).toBe(false)
    })

    test('throws and re-enables when getComponentMetadata returns nothing', async () => {
      const getComponentMetadata = vi.fn().mockResolvedValue(undefined)
      // The async click handler rejects ("Could not retrieve component metadata").
      // Swallow it via the app error handler so it doesn't surface as an
      // unhandled rejection while still exercising the finally block.
      const errorHandler = vi.fn()
      const { wrapper, initAddResource } = setup({
        resourceData: baseResource('heroImage'),
        pageData,
        resourcesConfig: { Image: { name: 'Hero Image' } },
        getComponentMetadata,
      }, errorHandler)
      const btn = findButton(wrapper)
      await btn.trigger('click')
      await flushPromises()
      expect(errorHandler).toHaveBeenCalled()
      // initAddResource never reached because getApiMetadata throws
      expect(initAddResource).not.toHaveBeenCalled()
      // finally block still re-enables the button
      expect(findButton(wrapper).props('disabled')).toBe(false)
    })

    test('returns early (no init/event) when apiMetadata for the component is missing', async () => {
      const getComponentMetadata = vi.fn().mockResolvedValue({ SomethingElse: {} })
      const { wrapper, initAddResource, setAddResourceEventResource } = setup({
        resourceData: baseResource('heroImage'),
        pageData,
        resourcesConfig: { Image: { name: 'Hero Image' } },
        getComponentMetadata,
      })
      await findButton(wrapper).trigger('click')
      await flushPromises()
      expect(initAddResource).not.toHaveBeenCalled()
      expect(setAddResourceEventResource).not.toHaveBeenCalled()
    })
  })

  describe('exposeMeta', () => {
    test('exposes the tab name "Data Placeholder"', () => {
      const { wrapper } = setup({
        resourceData: { data: { component: null, _metadata: { staticComponent: null }, pageDataProperty: null } },
      })
      expect((wrapper.vm as any).name).toBe('Data Placeholder')
    })
  })
})
