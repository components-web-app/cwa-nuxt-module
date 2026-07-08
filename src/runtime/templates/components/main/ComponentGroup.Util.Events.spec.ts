// @vitest-environment happy-dom
import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest'
import { reactive, ref, nextTick } from 'vue'
import { CwaResourceApiStatuses } from '#cwa/storage/stores/resources/state'
import { useComponentGroupEvents } from './ComponentGroup.Util.Events'

// A reactive resource store keyed by IRI; getResource returns a { value } wrapper like $cwa does.
let store: Record<string, any>

function makeCwa() {
  return {
    resources: {
      getResource: (iri: string) => ({ value: store[iri] }),
    },
  } as any
}

function component(status: CwaResourceApiStatuses, data: any = { '@id': 'x' }) {
  return reactive({ apiState: { status }, data })
}
function position(componentIri: string | undefined) {
  return reactive({ data: { component: componentIri } })
}

describe('useComponentGroupEvents', () => {
  beforeEach(() => {
    store = reactive({})
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  test('does not fire while the group is not loaded (positions undefined)', async () => {
    const onLoaded = vi.fn()
    const onUpdated = vi.fn()
    useComponentGroupEvents(ref(undefined), makeCwa(), { onLoaded, onUpdated })
    await nextTick()
    expect(onLoaded).not.toHaveBeenCalled()
  })

  test('does not fire while any component is IN_PROGRESS', async () => {
    store['/p1'] = position('/c1')
    store['/c1'] = component(CwaResourceApiStatuses.IN_PROGRESS)
    const onLoaded = vi.fn()
    useComponentGroupEvents(ref(['/p1']), makeCwa(), { onLoaded, onUpdated: vi.fn() })
    await nextTick()
    expect(onLoaded).not.toHaveBeenCalled()
  })

  test('fires componentsLoaded once with { component, position } pairs when all terminal', async () => {
    store['/p1'] = position('/c1')
    store['/p2'] = position('/c2')
    store['/c1'] = component(CwaResourceApiStatuses.SUCCESS)
    store['/c2'] = component(CwaResourceApiStatuses.SUCCESS)
    const onLoaded = vi.fn()
    useComponentGroupEvents(ref(['/p1', '/p2']), makeCwa(), { onLoaded, onUpdated: vi.fn() })
    await nextTick()
    expect(onLoaded).toHaveBeenCalledTimes(1)
    expect(onLoaded).toHaveBeenCalledWith([
      { component: '/c1', position: '/p1' },
      { component: '/c2', position: '/p2' },
    ])
  })

  test('excludes temporary (__new__ / adding) and errored/absent components from the payload but does not hang on them', async () => {
    store['/p1'] = position('/c1')
    store['/p2'] = position('__new__') // temporary add — skipped
    store['/p3'] = position('/c3') // errored — terminal, excluded from payload
    store['/c1'] = component(CwaResourceApiStatuses.SUCCESS)
    store['/c3'] = reactive({ apiState: { status: CwaResourceApiStatuses.ERROR }, data: undefined })
    const onLoaded = vi.fn()
    useComponentGroupEvents(ref(['/p1', '/p2', '/p3']), makeCwa(), { onLoaded, onUpdated: vi.fn() })
    await nextTick()
    expect(onLoaded).toHaveBeenCalledTimes(1)
    expect(onLoaded).toHaveBeenCalledWith([{ component: '/c1', position: '/p1' }])
  })

  test('fires componentsUpdated (debounced) when a component is added later, without re-firing componentsLoaded', async () => {
    store['/p1'] = position('/c1')
    store['/c1'] = component(CwaResourceApiStatuses.SUCCESS)
    const positions = ref(['/p1'])
    const onLoaded = vi.fn()
    const onUpdated = vi.fn()
    useComponentGroupEvents(positions, makeCwa(), { onLoaded, onUpdated })
    await nextTick()
    expect(onLoaded).toHaveBeenCalledTimes(1)

    // add a second, persisted component
    store['/p2'] = position('/c2')
    store['/c2'] = component(CwaResourceApiStatuses.SUCCESS)
    positions.value = ['/p1', '/p2']
    await nextTick()
    vi.runAllTimers() // flush debounce

    expect(onLoaded).toHaveBeenCalledTimes(1) // not re-fired
    expect(onUpdated).toHaveBeenCalledTimes(1)
    expect(onUpdated).toHaveBeenCalledWith([
      { component: '/c1', position: '/p1' },
      { component: '/c2', position: '/p2' },
    ])
  })

  test('fires componentsUpdated when a component is removed', async () => {
    store['/p1'] = position('/c1')
    store['/p2'] = position('/c2')
    store['/c1'] = component(CwaResourceApiStatuses.SUCCESS)
    store['/c2'] = component(CwaResourceApiStatuses.SUCCESS)
    const positions = ref(['/p1', '/p2'])
    const onUpdated = vi.fn()
    useComponentGroupEvents(positions, makeCwa(), { onLoaded: vi.fn(), onUpdated })
    await nextTick()

    positions.value = ['/p1']
    await nextTick()
    vi.runAllTimers()

    expect(onUpdated).toHaveBeenCalledTimes(1)
    expect(onUpdated).toHaveBeenCalledWith([{ component: '/c1', position: '/p1' }])
  })

  test('an empty (but loaded) group fires componentsLoaded once with an empty array', async () => {
    const onLoaded = vi.fn()
    useComponentGroupEvents(ref([]), makeCwa(), { onLoaded, onUpdated: vi.fn() })
    await nextTick()
    expect(onLoaded).toHaveBeenCalledTimes(1)
    expect(onLoaded).toHaveBeenCalledWith([])
  })
})
