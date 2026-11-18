// @vitest-environment happy-dom

import { describe, expect, vi, test, beforeEach, afterEach } from 'vitest'
import { createApp, defineAsyncComponent, defineComponent, h, onMounted, onUnmounted, ref, nextTick } from 'vue'
import { consola } from 'consola'
import type { Ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { useDataResolver } from './useDataResolver'

const realApp = createApp({ render: () => null })
const realVueApp: any = realApp
const mockGlobalComponents: Record<string, any> = realVueApp._context.components

const mockNuxtAppObj: any = {
  vueApp: realVueApp,
}

mockNuxtImport('useNuxtApp', () => () => mockNuxtAppObj)

const SyncMetaComponent = defineComponent({
  name: 'SyncMetaComponent',
  props: { iri: { type: String, default: undefined } },
  setup(props, { expose }) {
    expose({ received: { iri: props.iri } })
    return () => h('div', 'sync')
  },
})

function makeAsyncWrapper(resolvedFlag: { value: boolean }) {
  const wrapper = defineComponent({
    name: 'AsyncComponentWrapper',
    props: { iri: { type: String, default: undefined } },
    setup(props, { expose }) {
      expose({ asyncMeta: { iri: props.iri } })
      return () => h('div', 'async')
    },
  })
  Object.defineProperty(wrapper, '__asyncResolved', {
    get: () => resolvedFlag.value,
    configurable: true,
  })
  return wrapper
}

function mountResolver(
  allMeta: Ref<any[]>,
  ops: {
    components: Ref<any[] | undefined>
    props: Ref<any>
    propsValidator?: (props: any) => boolean
  },
) {
  const api: { startDataResolver?: () => void, stopDataResolver?: () => void } = {}
  const Host = defineComponent({
    setup() {
      const result = useDataResolver(allMeta, ops)
      api.startDataResolver = result.startDataResolver
      api.stopDataResolver = result.stopDataResolver
      return () => h('div')
    },
  })
  const wrapper = mount(Host)
  return { wrapper, api }
}

describe('useDataResolver', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const key of Object.keys(mockGlobalComponents)) {
      delete mockGlobalComponents[key]
    }
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    realVueApp.config.errorHandler = undefined
  })

  test('resets allMeta to an empty array on creation and returns control functions', () => {
    const allMeta = ref<any[]>(['existing'])
    const components = ref<any[] | undefined>(undefined)
    const props = ref({})

    const { api, wrapper } = mountResolver(allMeta, { components, props })

    expect(typeof api.startDataResolver).toBe('function')
    expect(typeof api.stopDataResolver).toBe('function')
    expect(allMeta.value).toEqual([])
    wrapper.unmount()
  })

  test('onMounted starts the resolver and fills a slot per component with its exposed metadata (sync path)', async () => {
    const allMeta = ref<any[]>([])
    const components = ref<any[] | undefined>([SyncMetaComponent])
    const props = ref({ iri: '/x' })

    const { wrapper } = mountResolver(allMeta, { components, props })

    await nextTick()

    expect(allMeta.value).toHaveLength(1)
    expect(allMeta.value[0]).toMatchObject({ received: { iri: '/x' } })
    wrapper.unmount()
  })

  test('resolves multiple components, each into its own slot index', async () => {
    const allMeta = ref<any[]>([])
    const Second = defineComponent({
      name: 'SecondMeta',
      props: { iri: { type: String, default: undefined } },
      setup(_p, { expose }) {
        expose({ which: 'second' })
        return () => h('div')
      },
    })
    const components = ref<any[] | undefined>([SyncMetaComponent, Second])
    const props = ref({ iri: '/multi' })

    const { wrapper } = mountResolver(allMeta, { components, props })
    await nextTick()

    expect(allMeta.value).toHaveLength(2)
    expect(allMeta.value[0]).toMatchObject({ received: { iri: '/multi' } })
    expect(allMeta.value[1]).toMatchObject({ which: 'second' })
    wrapper.unmount()
  })

  test('resolves a component referenced by string name via global components', async () => {
    mockGlobalComponents.MyGlobalTab = SyncMetaComponent
    const allMeta = ref<any[]>([])
    const components = ref<any[] | undefined>(['MyGlobalTab'])
    const props = ref({ iri: '/global' })

    const { wrapper } = mountResolver(allMeta, { components, props })
    await nextTick()

    expect(allMeta.value).toHaveLength(1)
    expect(allMeta.value[0]).toMatchObject({ received: { iri: '/global' } })
    wrapper.unmount()
  })

  test('propsValidator returning false short-circuits and leaves allMeta sized but empty', async () => {
    const allMeta = ref<any[]>([])
    const components = ref<any[] | undefined>([SyncMetaComponent])
    const props = ref({ iri: undefined })
    const validator = vi.fn((p: any) => !!p.iri)

    const { wrapper } = mountResolver(allMeta, { components, props, propsValidator: validator })
    await nextTick()

    expect(validator).toHaveBeenCalledWith({ iri: undefined })
    expect(allMeta.value).toHaveLength(1)
    expect(allMeta.value[0]).toBeUndefined()
    wrapper.unmount()
  })

  test('propsValidator returning true allows population', async () => {
    const allMeta = ref<any[]>([])
    const components = ref<any[] | undefined>([SyncMetaComponent])
    const props = ref({ iri: '/valid' })
    const validator = vi.fn((p: any) => !!p.iri)

    const { wrapper } = mountResolver(allMeta, { components, props, propsValidator: validator })
    await nextTick()

    expect(validator).toHaveBeenCalled()
    expect(allMeta.value).toHaveLength(1)
    expect(allMeta.value[0]).toMatchObject({ received: { iri: '/valid' } })
    wrapper.unmount()
  })

  test('re-runs when components ref changes, resizing allMeta', async () => {
    const allMeta = ref<any[]>([])
    const components = ref<any[] | undefined>([SyncMetaComponent])
    const props = ref({ iri: '/a' })

    const { wrapper } = mountResolver(allMeta, { components, props })
    await nextTick()
    expect(allMeta.value).toHaveLength(1)

    const Second = defineComponent({
      name: 'AnotherMeta',
      props: { iri: { type: String, default: undefined } },
      setup(_p, { expose }) {
        expose({ tag: 'another' })
        return () => h('div')
      },
    })
    components.value = [SyncMetaComponent, Second]
    await nextTick()

    expect(allMeta.value).toHaveLength(2)
    wrapper.unmount()
  })

  test('re-runs when props ref changes, re-rendering the component slot', async () => {
    const allMeta = ref<any[]>([])
    const components = ref<any[] | undefined>([SyncMetaComponent])
    const props = ref({ iri: '/first' })

    const { wrapper } = mountResolver(allMeta, { components, props })
    await nextTick()
    expect(allMeta.value).toHaveLength(1)

    allMeta.value = ['stale-marker']
    props.value = { iri: '/second' }
    await nextTick()

    expect(allMeta.value).toHaveLength(1)
    expect(allMeta.value[0]).not.toBe('stale-marker')
    wrapper.unmount()
  })

  test('throws when a string component cannot be found in global components', () => {
    const allMeta = ref<any[]>([])
    const components = ref<any[] | undefined>(['DoesNotExist'])
    const props = ref({ iri: '/x' })

    expect(() => mountResolver(allMeta, { components, props })).toThrow('Cannot load metadata for component')
  })

  test('startDataResolver is idempotent (calling again does not create a second watch)', async () => {
    const allMeta = ref<any[]>([])
    const components = ref<any[] | undefined>([SyncMetaComponent])
    const props = ref({ iri: '/idem' })

    const { api, wrapper } = mountResolver(allMeta, { components, props })
    await nextTick()
    expect(allMeta.value).toHaveLength(1)

    api.startDataResolver!()
    expect(allMeta.value).toHaveLength(1)
    wrapper.unmount()
  })

  test('stopDataResolver halts reactivity so later changes do not update allMeta', async () => {
    const allMeta = ref<any[]>([])
    const components = ref<any[] | undefined>([SyncMetaComponent])
    const props = ref({ iri: '/stop' })

    const { api, wrapper } = mountResolver(allMeta, { components, props })
    await nextTick()
    expect(allMeta.value).toHaveLength(1)

    api.stopDataResolver!()

    components.value = [SyncMetaComponent, SyncMetaComponent]
    await nextTick()
    expect(allMeta.value).toHaveLength(1)
    wrapper.unmount()
  })

  test('onBeforeUnmount stops the resolver (no errors / no further updates)', async () => {
    const allMeta = ref<any[]>([])
    const components = ref<any[] | undefined>([SyncMetaComponent])
    const props = ref({ iri: '/unmount' })

    const { wrapper } = mountResolver(allMeta, { components, props })
    await nextTick()
    expect(allMeta.value).toHaveLength(1)

    wrapper.unmount()

    components.value = [SyncMetaComponent, SyncMetaComponent]
    await nextTick()
    expect(allMeta.value).toHaveLength(1)
  })

  test('handles undefined components gracefully (empty allMeta, no throw)', async () => {
    const allMeta = ref<any[]>([])
    const components = ref<any[] | undefined>(undefined)
    const props = ref({ iri: '/none' })

    const { wrapper } = mountResolver(allMeta, { components, props })
    await nextTick()

    expect(allMeta.value).toEqual([])
    wrapper.unmount()
  })

  describe('async component resolution', () => {
    test('reads the metadata of an already-resolved async wrapper once its template ref is set', async () => {
      const allMeta = ref<any[]>([])
      const flag = { value: true }
      const asyncComp = makeAsyncWrapper(flag)
      const components = ref<any[] | undefined>([asyncComp])
      const props = ref({ iri: '/async-ready' })

      const { wrapper } = mountResolver(allMeta, { components, props })
      await nextTick()

      expect(allMeta.value).toHaveLength(1)
      expect(allMeta.value[0]).toMatchObject({ asyncMeta: { iri: '/async-ready' } })
      wrapper.unmount()
    })

    test('polls an unresolved async wrapper and completes once it resolves', async () => {
      vi.useFakeTimers()
      const allMeta = ref<any[]>([])
      const flag = { value: false }
      const asyncComp = makeAsyncWrapper(flag)
      const components = ref<any[] | undefined>([asyncComp])
      const props = ref({ iri: '/async-pending' })

      const { wrapper } = mountResolver(allMeta, { components, props })
      await nextTick()

      expect(allMeta.value).toHaveLength(1)
      expect(allMeta.value[0]).toBeUndefined()

      flag.value = true
      vi.advanceTimersByTime(10)
      vi.useRealTimers()
      await nextTick()

      expect(allMeta.value[0]).toEqual({ asyncMeta: { iri: '/async-pending' } })
      wrapper.unmount()
    })

    test('stops previously-registered resolved watchers when inputs change again', async () => {
      const allMeta = ref<any[]>([])
      const flag = { value: false }
      const asyncComp = makeAsyncWrapper(flag)
      const components = ref<any[] | undefined>([asyncComp])
      const props = ref({ iri: '/pending' })

      const { wrapper } = mountResolver(allMeta, { components, props })
      await nextTick()
      expect(allMeta.value[0]).toBeUndefined()

      components.value = [SyncMetaComponent]
      await nextTick()

      expect(allMeta.value).toHaveLength(1)
      expect(allMeta.value[0]).toEqual({ received: { iri: '/pending' } })

      flag.value = true
      await new Promise(r => setTimeout(r, 20))
      await nextTick()

      expect(allMeta.value).toHaveLength(1)
      expect(allMeta.value[0]).toEqual({ received: { iri: '/pending' } })
      expect(allMeta.value[0]).not.toEqual({ asyncMeta: { iri: '/pending' } })
      wrapper.unmount()
    })
  })

  describe('detached instances still loading (#461)', () => {
    function deferredComponent() {
      const mounted = vi.fn()
      const unmounted = vi.fn()
      let load!: () => void
      const Inner = defineComponent({
        setup(_props, { expose }) {
          expose({ loaded: true })
          onMounted(mounted)
          onUnmounted(unmounted)
          return () => h('div')
        },
      })
      const component = defineAsyncComponent(() => new Promise<typeof Inner>((resolve) => {
        load = () => resolve(Inner)
      }))
      return { component, mounted, unmounted, load: () => load() }
    }

    async function settle() {
      await flushPromises()
      await new Promise(resolve => setTimeout(resolve, 30))
      await flushPromises()
    }

    test('reads the metadata once the chunk loads, then unmounts the detached instance', async () => {
      const { component, mounted, unmounted, load } = deferredComponent()
      const allMeta = ref<any[]>([])
      const { wrapper } = mountResolver(allMeta, { components: ref([component]), props: ref({}) })
      await nextTick()

      load()
      await settle()

      expect(allMeta.value[0]).toMatchObject({ loaded: true })
      expect(mounted).toHaveBeenCalledTimes(1)
      expect(unmounted).toHaveBeenCalledTimes(1)
      wrapper.unmount()
    })

    test('unmounting the owner before the chunk loads unmounts the detached instance and stops polling', async () => {
      const setInterval = vi.spyOn(window, 'setInterval')
      const clearInterval = vi.spyOn(window, 'clearInterval')
      const { component, mounted, unmounted, load } = deferredComponent()
      const allMeta = ref<any[]>([])
      const { wrapper } = mountResolver(allMeta, { components: ref([component]), props: ref({}) })
      await nextTick()
      const polling = setInterval.mock.results[0]!.value

      wrapper.unmount()
      expect(clearInterval).toHaveBeenCalledWith(polling)
      load()
      await settle()

      expect(unmounted).toHaveBeenCalledTimes(mounted.mock.calls.length)
    })

    test('stopDataResolver unmounts the detached instances still loading', async () => {
      const { component, mounted, unmounted, load } = deferredComponent()
      const allMeta = ref<any[]>([])
      const { api, wrapper } = mountResolver(allMeta, { components: ref([component]), props: ref({}) })
      await nextTick()

      api.stopDataResolver!()
      load()
      await settle()

      expect(unmounted).toHaveBeenCalledTimes(mounted.mock.calls.length)
      expect(allMeta.value[0]).toBeUndefined()
      wrapper.unmount()
    })

    test('new inputs unmount the detached instances of the previous ones still loading', async () => {
      const { component, mounted, unmounted, load } = deferredComponent()
      const allMeta = ref<any[]>([])
      const components = ref<any[]>([component])
      const { wrapper } = mountResolver(allMeta, { components, props: ref({}) })
      await nextTick()

      components.value = [SyncMetaComponent]
      await nextTick()
      load()
      await settle()

      expect(unmounted).toHaveBeenCalledTimes(mounted.mock.calls.length)
      wrapper.unmount()
    })
  })

  describe('a component that cannot be rendered (#461)', () => {
    const Throws = defineComponent({
      name: 'Throws',
      setup(_props, { expose }) {
        expose({ styles: { classes: { Dark: 'dark' } } })
        return () => {
          throw new Error('no data')
        }
      },
    })

    test('gives no metadata and never reaches the app error handler, with a warning in development', async () => {
      const errorHandler = vi.fn()
      realVueApp.config.errorHandler = errorHandler
      const warn = vi.spyOn(consola, 'warn').mockImplementation(() => undefined)
      const allMeta = ref<any[]>([])

      const { wrapper } = mountResolver(allMeta, { components: ref([Throws, SyncMetaComponent]), props: ref({ iri: '/new' }) })
      await flushPromises()

      expect(allMeta.value[0]).toBeNull()
      expect(allMeta.value[1]).toMatchObject({ received: { iri: '/new' } })
      expect(errorHandler).not.toHaveBeenCalled()
      expect(warn).toHaveBeenCalledTimes(1)
      expect(warn.mock.calls[0]![0]).toContain('Throws could not be rendered')
      wrapper.unmount()
    })

    test('warns nothing in production', async () => {
      vi.stubEnv('DEV', false)
      const warn = vi.spyOn(consola, 'warn').mockImplementation(() => undefined)
      const allMeta = ref<any[]>([])

      const { wrapper } = mountResolver(allMeta, { components: ref([Throws]), props: ref({}) })
      await flushPromises()

      expect(allMeta.value[0]).toBeNull()
      expect(warn).not.toHaveBeenCalled()
      wrapper.unmount()
    })
  })
})
