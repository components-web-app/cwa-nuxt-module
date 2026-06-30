// @vitest-environment happy-dom

import { describe, expect, vi, test, beforeEach, afterEach } from 'vitest'
import { createApp, defineComponent, h, ref, nextTick } from 'vue'
import type { Ref } from 'vue'
import { mount } from '@vue/test-utils'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { useDataResolver } from './useDataResolver'

// Use a *real* Vue app so its _context has the internal caches
// (propsCache/optionsCache/emitsCache WeakMaps etc.) that Vue's renderer relies
// on when we assign vnode.appContext and call render().
const realApp = createApp({ render: () => null })
const realVueApp: any = realApp
const mockGlobalComponents: Record<string, any> = realVueApp._context.components

const mockNuxtAppObj: any = {
  vueApp: realVueApp,
}

mockNuxtImport('useNuxtApp', () => () => mockNuxtAppObj)

// A synchronous metadata component. useDataResolver spreads `cProps` onto the
// rendered component (so individual prop keys are passed, not a `cProps` object)
// and binds `ref: metadata` to capture the exposed value.
//
// NOTE ON TIMING: for a component that is NOT an AsyncComponentWrapper, the SUT
// marks it resolved synchronously and calls completeLoad() immediately after
// render(). At that instant Vue has not yet bound the template ref, so the
// captured metadata is `null`. This is the real behaviour of the SUT for the
// synchronous path; the async path (below) captures the exposed value because
// completeLoad runs later via the watcher.
const SyncMetaComponent = defineComponent({
  name: 'SyncMetaComponent',
  props: { iri: { type: String, default: undefined } },
  setup(props, { expose }) {
    expose({ received: { iri: props.iri } })
    return () => h('div', 'sync')
  },
})

// Simulate Vue's AsyncComponentWrapper: name === 'AsyncComponentWrapper'
// and __asyncResolved toggling from falsy to truthy. The SUT spreads cProps
// onto this component, so it receives `iri` directly (not a cProps object).
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

/**
 * Helper to drive the composable inside a real component setup() so that the
 * onMounted / onBeforeUnmount lifecycle hooks actually run.
 */
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
  })

  test('resets allMeta to an empty array on creation and returns control functions', () => {
    const allMeta = ref<any[]>(['existing'])
    const components = ref<any[] | undefined>(undefined)
    const props = ref({})

    const { api, wrapper } = mountResolver(allMeta, { components, props })

    expect(typeof api.startDataResolver).toBe('function')
    expect(typeof api.stopDataResolver).toBe('function')
    // initial reset + watcher immediate run (no components -> empty array)
    expect(allMeta.value).toEqual([])
    wrapper.unmount()
  })

  test('onMounted starts the resolver and fills a slot per component (sync path)', async () => {
    const allMeta = ref<any[]>([])
    const components = ref<any[] | undefined>([SyncMetaComponent])
    const props = ref({ iri: '/x' })

    const { wrapper } = mountResolver(allMeta, { components, props })

    await nextTick()

    // One entry. Sync-resolved components complete immediately (before the
    // template ref binds) so the captured metadata is null.
    expect(allMeta.value).toHaveLength(1)
    expect(allMeta.value[0]).toBeNull()
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
    // both sync-resolved -> null in their respective slots
    expect(allMeta.value[0]).toBeNull()
    expect(allMeta.value[1]).toBeNull()
    wrapper.unmount()
  })

  test('resolves a component referenced by string name via global components', async () => {
    mockGlobalComponents.MyGlobalTab = SyncMetaComponent
    const allMeta = ref<any[]>([])
    const components = ref<any[] | undefined>(['MyGlobalTab'])
    const props = ref({ iri: '/global' })

    const { wrapper } = mountResolver(allMeta, { components, props })
    await nextTick()

    // String name was looked up in globalComponents and rendered successfully.
    expect(allMeta.value).toHaveLength(1)
    expect(allMeta.value[0]).toBeNull()
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
    // array sized to component count but never populated (early return)
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
    // validator passed -> the component was rendered and its slot completed.
    expect(allMeta.value).toHaveLength(1)
    expect(allMeta.value[0]).toBeNull()
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

    // The SUT watches [components, props]; a props change must trigger a fresh
    // handleInputChange which rebuilds allMeta rather than leaving it stale.
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

    // The error is thrown during render of rootDefinition inside handleInputChange,
    // which is triggered by the immediate watch in startDataResolver (onMounted).
    expect(() => mountResolver(allMeta, { components, props })).toThrow('Cannot load metadata for component')
  })

  test('startDataResolver is idempotent (calling again does not create a second watch)', async () => {
    const allMeta = ref<any[]>([])
    const components = ref<any[] | undefined>([SyncMetaComponent])
    const props = ref({ iri: '/idem' })

    const { api, wrapper } = mountResolver(allMeta, { components, props })
    await nextTick()
    expect(allMeta.value).toHaveLength(1)

    // Calling start again should early-return (stopPrimaryWatch already set) and
    // not reset allMeta to [].
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

    // Change components after stopping — handleInputChange should not run.
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

    // After unmount the watch is stopped; mutating refs should be a no-op.
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
    test('treats an already-resolved async wrapper as resolved immediately (completes synchronously)', async () => {
      const allMeta = ref<any[]>([])
      const flag = { value: true }
      const asyncComp = makeAsyncWrapper(flag)
      const components = ref<any[] | undefined>([asyncComp])
      const props = ref({ iri: '/async-ready' })

      const { wrapper } = mountResolver(allMeta, { components, props })
      await nextTick()

      // Already resolved -> completeLoad runs synchronously before the ref binds,
      // so the slot is filled (length 1) but metadata is null. Crucially, no
      // polling interval/watcher is set up for this branch.
      expect(allMeta.value).toHaveLength(1)
      expect(allMeta.value[0]).toBeNull()
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

      // Not resolved yet — slot remains empty.
      expect(allMeta.value).toHaveLength(1)
      expect(allMeta.value[0]).toBeUndefined()

      // Resolve and advance the polling interval (10ms).
      flag.value = true
      vi.advanceTimersByTime(10)
      // allow watcher (resolved -> true) to flush
      vi.useRealTimers()
      await nextTick()

      expect(allMeta.value[0]).toEqual({ asyncMeta: { iri: '/async-pending' } })
      wrapper.unmount()
    })

    test('stops previously-registered resolved watchers when inputs change again', async () => {
      // First render registers a deferred watcher (unresolved async wrapper).
      // Changing components re-runs handleInputChange, which must stop the
      // previously-registered watchers before rebuilding.
      const allMeta = ref<any[]>([])
      const flag = { value: false }
      const asyncComp = makeAsyncWrapper(flag)
      const components = ref<any[] | undefined>([asyncComp])
      const props = ref({ iri: '/pending' })

      const { wrapper } = mountResolver(allMeta, { components, props })
      await nextTick()
      // Deferred — slot still empty (watcher registered).
      expect(allMeta.value[0]).toBeUndefined()

      // Change components -> handleInputChange re-runs and unwatches the prior
      // deferred watcher before processing the new list.
      components.value = [SyncMetaComponent]
      await nextTick()

      expect(allMeta.value).toHaveLength(1)
      // The slot reflects the new sync component, not the old async wrapper.
      expect(allMeta.value[0]).toEqual({ received: { iri: '/pending' } })

      // Now resolving the original async wrapper must NOT overwrite the rebuilt
      // allMeta, because its watcher was stopped during the re-run.
      flag.value = true
      await new Promise(r => setTimeout(r, 20))
      await nextTick()

      expect(allMeta.value).toHaveLength(1)
      expect(allMeta.value[0]).toEqual({ received: { iri: '/pending' } })
      expect(allMeta.value[0]).not.toEqual({ asyncMeta: { iri: '/pending' } })
      wrapper.unmount()
    })
  })
})
