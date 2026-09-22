// @vitest-environment happy-dom
import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest'
import { computed, reactive } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { useComponentGroupPositions } from './ComponentGroup.Util.Positions'
import { Resources } from '#cwa/resources/resources'
import { ResourcesStore } from '#cwa/storage/stores/resources/resources-store'
import { FetcherStore } from '#cwa/storage/stores/fetcher/fetcher-store'
import type { CwaResource } from '#cwa/resources/resource-utils'
import type { ReorderEvent } from '#cwa/admin/admin'

vi.mock('vue', async () => {
  const mod = await vi.importActual<typeof import('vue')>('vue')
  return {
    ...mod,
    onMounted: (fn: () => void) => fn(),
    onBeforeUnmount: vi.fn(),
  }
})

function buildCwa(positions: string[], resources: Record<string, any> = {}, iri = '/_/component_groups/1') {
  let capturedHandler: ((e: ReorderEvent) => void) | undefined

  const mockCwa: any = {
    admin: {
      resourceStackManager: {
        getState: vi.fn().mockReturnValue(true),
        getClosestStackItemByType: vi.fn().mockReturnValue(iri),
      },
      eventBus: {
        on: vi.fn((_event: string, handler: any) => { capturedHandler = handler }),
        off: vi.fn(),
      },
      emitRedraw: vi.fn(),
    },
    resources: {
      getOrderedPositionsForGroup: vi.fn().mockReturnValue(positions),
      getPendingResource: vi.fn(),
      getResource: vi.fn((posIri: string) => ({
        value: resources[posIri] ? { data: resources[posIri] } : undefined,
      })),
    },
    resourcesManager: {
      storeResource: vi.fn(),
      updateResource: vi.fn().mockResolvedValue(undefined),
    },
  }

  return { mockCwa, getCapturedHandler: () => capturedHandler! }
}

describe('useComponentGroupPositions', () => {
  const groupIri = '/_/component_groups/1'
  const iriRef = computed(() => groupIri)

  describe('groupIsReordering', () => {
    test('returns false when iri is undefined', () => {
      const { mockCwa } = buildCwa([])
      const { groupIsReordering } = useComponentGroupPositions(computed(() => undefined), mockCwa)
      expect(groupIsReordering.value).toBe(false)
    })

    test('returns false when getState returns falsy', () => {
      const { mockCwa } = buildCwa([])
      mockCwa.admin.resourceStackManager.getState.mockReturnValue(false)
      const { groupIsReordering } = useComponentGroupPositions(iriRef, mockCwa)
      expect(groupIsReordering.value).toBe(false)
    })

    test('returns false when not the closest component group', () => {
      const { mockCwa } = buildCwa([])
      mockCwa.admin.resourceStackManager.getClosestStackItemByType.mockReturnValue('/_/component_groups/other')
      const { groupIsReordering } = useComponentGroupPositions(iriRef, mockCwa)
      expect(groupIsReordering.value).toBe(false)
    })

    test('returns true when reordering is active and iri matches closest group', () => {
      const { mockCwa } = buildCwa([])
      const { groupIsReordering } = useComponentGroupPositions(iriRef, mockCwa)
      expect(groupIsReordering.value).toBe(true)
    })
  })

  describe('componentPositions', () => {
    test('returns positions from getOrderedPositionsForGroup', () => {
      const positions = ['/_/component_positions/a', '/_/component_positions/b']
      const { mockCwa } = buildCwa(positions)
      const { componentPositions } = useComponentGroupPositions(iriRef, mockCwa)
      expect(componentPositions.value).toEqual(positions)
    })

    test('returns undefined when iri is undefined', () => {
      const { mockCwa } = buildCwa([])
      const { componentPositions } = useComponentGroupPositions(computed(() => undefined), mockCwa)
      expect(componentPositions.value).toBeUndefined()
    })
  })

  describe('handleReorderEvent (via event bus)', () => {
    let resources: Record<string, any>
    let positions: string[]

    beforeEach(() => {
      positions = [
        '/_/component_positions/a',
        '/_/component_positions/b',
        '/_/component_positions/c',
      ]
      resources = {
        '/_/component_positions/a': { '@id': '/_/component_positions/a', 'sortValue': 1, '_metadata': {} },
        '/_/component_positions/b': { '@id': '/_/component_positions/b', 'sortValue': 2, '_metadata': {} },
        '/_/component_positions/c': { '@id': '/_/component_positions/c', 'sortValue': 3, '_metadata': {} },
      }
    })

    test('does nothing when groupIsReordering is false', () => {
      const { mockCwa, getCapturedHandler } = buildCwa(positions, resources)
      mockCwa.admin.resourceStackManager.getState.mockReturnValue(false)
      useComponentGroupPositions(iriRef, mockCwa)
      getCapturedHandler()({ positionIri: '/_/component_positions/a', location: 'next' })
      expect(mockCwa.resourcesManager.storeResource).not.toHaveBeenCalled()
    })

    test('does nothing when positionIri is not in positions', () => {
      const { mockCwa, getCapturedHandler } = buildCwa(positions, resources)
      useComponentGroupPositions(iriRef, mockCwa)
      getCapturedHandler()({ positionIri: '/_/component_positions/z', location: 'next' })
      expect(mockCwa.resourcesManager.storeResource).not.toHaveBeenCalled()
    })

    test('location: next moves position forward and updates sortDisplayNumbers', () => {
      const { mockCwa, getCapturedHandler } = buildCwa(positions, resources)
      useComponentGroupPositions(iriRef, mockCwa)
      getCapturedHandler()({ positionIri: '/_/component_positions/a', location: 'next' })
      expect(mockCwa.resourcesManager.storeResource).toHaveBeenCalledTimes(3)
      const calls = mockCwa.resourcesManager.storeResource.mock.calls
      const updated = Object.fromEntries(calls.map(([{ resource }]: any) => [resource['@id'], resource._metadata.sortDisplayNumber]))
      expect(updated['/_/component_positions/b']).toBe(1)
      expect(updated['/_/component_positions/a']).toBe(2)
      expect(updated['/_/component_positions/c']).toBe(3)
    })

    test('location: previous moves position backward', () => {
      const { mockCwa, getCapturedHandler } = buildCwa(positions, resources)
      useComponentGroupPositions(iriRef, mockCwa)
      getCapturedHandler()({ positionIri: '/_/component_positions/c', location: 'previous' })
      const calls = mockCwa.resourcesManager.storeResource.mock.calls
      const updated = Object.fromEntries(calls.map(([{ resource }]: any) => [resource['@id'], resource._metadata.sortDisplayNumber]))
      expect(updated['/_/component_positions/a']).toBe(1)
      expect(updated['/_/component_positions/c']).toBe(2)
      expect(updated['/_/component_positions/b']).toBe(3)
    })

    test('location: previous clamps to index 0 when already first', () => {
      const { mockCwa, getCapturedHandler } = buildCwa(positions, resources)
      useComponentGroupPositions(iriRef, mockCwa)
      getCapturedHandler()({ positionIri: '/_/component_positions/a', location: 'previous' })
      const calls = mockCwa.resourcesManager.storeResource.mock.calls
      const updated = Object.fromEntries(calls.map(([{ resource }]: any) => [resource['@id'], resource._metadata.sortDisplayNumber]))
      expect(updated['/_/component_positions/a']).toBe(1)
    })

    test('location: absolute number moves to that position (1-indexed)', () => {
      const { mockCwa, getCapturedHandler } = buildCwa(positions, resources)
      useComponentGroupPositions(iriRef, mockCwa)
      getCapturedHandler()({ positionIri: '/_/component_positions/a', location: 3 })
      const calls = mockCwa.resourcesManager.storeResource.mock.calls
      const updated = Object.fromEntries(calls.map(([{ resource }]: any) => [resource['@id'], resource._metadata.sortDisplayNumber]))
      expect(updated['/_/component_positions/a']).toBe(3)
      expect(updated['/_/component_positions/b']).toBe(1)
      expect(updated['/_/component_positions/c']).toBe(2)
    })

    test('calls emitRedraw after reorder', () => {
      const { mockCwa, getCapturedHandler } = buildCwa(positions, resources)
      useComponentGroupPositions(iriRef, mockCwa)
      getCapturedHandler()({ positionIri: '/_/component_positions/a', location: 'next' })
      expect(mockCwa.admin.emitRedraw).toHaveBeenCalledOnce()
    })

    test('skips positions with no resource data when updating sortDisplayNumbers', () => {
      const sparsePositions = ['/_/component_positions/a', '/_/component_positions/missing', '/_/component_positions/c']
      const sparseResources: Record<string, any> = {
        '/_/component_positions/a': { '@id': '/_/component_positions/a', 'sortValue': 1, '_metadata': {} },
        '/_/component_positions/c': { '@id': '/_/component_positions/c', 'sortValue': 3, '_metadata': {} },
      }
      const { mockCwa, getCapturedHandler } = buildCwa(sparsePositions, sparseResources)
      useComponentGroupPositions(iriRef, mockCwa)
      getCapturedHandler()({ positionIri: '/_/component_positions/a', location: 'next' })
      expect(mockCwa.resourcesManager.storeResource).toHaveBeenCalledTimes(2)
    })
  })

  describe('sendUpdatePositionRequest (via debounce)', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    function buildDynamicCwa(initialPositions: string[], initialResources: Record<string, any>) {
      const positionResources = reactive(JSON.parse(JSON.stringify(initialResources)))

      let capturedHandler: ((e: ReorderEvent) => void) | undefined
      const iri = '/_/component_groups/1'

      const mockCwa: any = {
        admin: {
          resourceStackManager: {
            getState: vi.fn().mockReturnValue(true),
            getClosestStackItemByType: vi.fn().mockReturnValue(iri),
          },
          eventBus: {
            on: vi.fn((_event: string, handler: any) => { capturedHandler = handler }),
            off: vi.fn(),
          },
          emitRedraw: vi.fn(),
        },
        resources: {
          getOrderedPositionsForGroup: vi.fn(() => {
            return [...initialPositions].sort((a, b) => {
              const aNum = positionResources[a]?._metadata?.sortDisplayNumber ?? positionResources[a]?.sortValue ?? 0
              const bNum = positionResources[b]?._metadata?.sortDisplayNumber ?? positionResources[b]?.sortValue ?? 0
              return aNum - bNum
            })
          }),
          getResource: vi.fn((posIri: string) => ({
            value: positionResources[posIri] ? { data: positionResources[posIri] } : undefined,
          })),
          getPendingResource: vi.fn(),
        },
        resourcesManager: {
          storeResource: vi.fn(({ resource }) => {
            positionResources[resource['@id']] = { ...resource, _metadata: { ...resource._metadata } }
          }),
          updateResource: vi.fn().mockResolvedValue(undefined),
        },
      }

      return { mockCwa, getCapturedHandler: () => capturedHandler! }
    }

    test('calls updateResource after debounce fires', async () => {
      const { nextTick } = await import('vue')
      const initialResources: Record<string, any> = {
        '/_/component_positions/a': { '@id': '/_/component_positions/a', 'sortValue': 1, '_metadata': {} },
        '/_/component_positions/b': { '@id': '/_/component_positions/b', 'sortValue': 2, '_metadata': {} },
        '/_/component_positions/c': { '@id': '/_/component_positions/c', 'sortValue': 3, '_metadata': {} },
      }
      const initialPositions = ['/_/component_positions/a', '/_/component_positions/b', '/_/component_positions/c']
      const { mockCwa, getCapturedHandler } = buildDynamicCwa(initialPositions, initialResources)
      useComponentGroupPositions(iriRef, mockCwa)
      getCapturedHandler()({ positionIri: '/_/component_positions/a', location: 'next' })
      vi.advanceTimersByTime(1100)
      await nextTick()
      await nextTick()
      expect(mockCwa.resourcesManager.updateResource).toHaveBeenCalledWith(expect.objectContaining({
        endpoint: '/_/component_positions/a',
        data: expect.objectContaining({ sortValue: expect.any(Number) }),
      }))
    })

    test('does not call updateResource when position index did not change', async () => {
      const { nextTick } = await import('vue')
      const initialResources: Record<string, any> = {
        '/_/component_positions/a': { '@id': '/_/component_positions/a', 'sortValue': 1, '_metadata': {} },
        '/_/component_positions/b': { '@id': '/_/component_positions/b', 'sortValue': 2, '_metadata': {} },
      }
      const initialPositions = ['/_/component_positions/a', '/_/component_positions/b']
      const { mockCwa, getCapturedHandler } = buildDynamicCwa(initialPositions, initialResources)
      useComponentGroupPositions(iriRef, mockCwa)
      getCapturedHandler()({ positionIri: '/_/component_positions/a', location: 'previous' })
      vi.advanceTimersByTime(1100)
      await nextTick()
      await nextTick()
      expect(mockCwa.resourcesManager.updateResource).not.toHaveBeenCalled()
    })

    test('cancels previous debounce when same position reordered again', async () => {
      const { nextTick } = await import('vue')
      const initialResources: Record<string, any> = {
        '/_/component_positions/a': { '@id': '/_/component_positions/a', 'sortValue': 1, '_metadata': {} },
        '/_/component_positions/b': { '@id': '/_/component_positions/b', 'sortValue': 2, '_metadata': {} },
        '/_/component_positions/c': { '@id': '/_/component_positions/c', 'sortValue': 3, '_metadata': {} },
      }
      const initialPositions = ['/_/component_positions/a', '/_/component_positions/b', '/_/component_positions/c']
      const { mockCwa, getCapturedHandler } = buildDynamicCwa(initialPositions, initialResources)
      useComponentGroupPositions(iriRef, mockCwa)
      getCapturedHandler()({ positionIri: '/_/component_positions/a', location: 'next' })
      vi.advanceTimersByTime(500)
      getCapturedHandler()({ positionIri: '/_/component_positions/a', location: 'next' })
      vi.advanceTimersByTime(1100)
      await nextTick()
      await nextTick()
      expect(mockCwa.resourcesManager.updateResource).toHaveBeenCalledTimes(1)
    })
  })
})

describe('group reorder queue against the server', () => {
  const groupIri = '/_/component_groups/g'
  const positionIri = (name: string) => `/_/component_positions/${name}`
  const nameOf = (iri: string) => iri.split('/').pop()!

  function serverMove(values: Record<string, number>, moved: string, moveTo: number) {
    const original = values[moved]!
    values[moved] = moveTo
    for (const name of Object.keys(values)) {
      if (name === moved) {
        continue
      }
      const value = values[name]!
      if (moveTo > original && value > original && value <= moveTo) {
        values[name] = value - 1
      }
      if (moveTo < original && value < original && value >= moveTo) {
        values[name] = value + 1
      }
    }
  }

  function createGroup(initial: Record<string, number>, options: { failRequests?: () => boolean } = {}) {
    setActivePinia(createPinia())
    const resourcesStoreDef = new ResourcesStore('cwa')
    const store = resourcesStoreDef.useStore()
    const resources = new Resources(resourcesStoreDef, new FetcherStore('cwa'))
    const server: Record<string, number> = { ...initial }
    const names = Object.keys(initial)
    const serverOrder = () => [...names].sort((a, b) => server[a]! - server[b]!)
    const toResource = (name: string, sortValue: number) => ({ '@id': positionIri(name), '@type': 'ComponentPosition', 'componentGroup': groupIri, sortValue, '_metadata': {} } as unknown as CwaResource)
    store.saveResource({ resource: { '@id': groupIri, '@type': 'ComponentGroup', 'componentPositions': names.map(positionIri), '_metadata': {} } as unknown as CwaResource })
    for (const name of names) {
      store.saveResource({ resource: toResource(name, server[name]!) })
    }
    let handler: ((e: ReorderEvent) => void) | undefined
    const requests: Array<[string, number]> = []
    const mockCwa: any = {
      admin: {
        resourceStackManager: { getState: () => true, getClosestStackItemByType: () => groupIri },
        eventBus: { on: (_e: string, h: any) => { handler = h }, off: vi.fn() },
        emitRedraw: vi.fn(),
      },
      resources,
      resourcesManager: {
        storeResource: (event: any) => store.saveResource(event),
        updateResource: async (event: any) => {
          requests.push([nameOf(event.endpoint), event.data.sortValue])
          await Promise.resolve()
          if (options.failRequests?.()) {
            return undefined
          }
          serverMove(server, nameOf(event.endpoint), event.data.sortValue)
          const response = toResource(nameOf(event.endpoint), server[nameOf(event.endpoint)]!)
          store.saveResource({ resource: response })
          return response
        },
      },
    }
    useComponentGroupPositions(computed(() => groupIri), mockCwa)
    return {
      store,
      server,
      requests,
      serverOrder,
      move: (name: string, location: any) => handler!({ positionIri: positionIri(name), location }),
      displayed: () => store.getOrderedPositionsForGroup(groupIri)!.map(nameOf),
      localValues: () => Object.fromEntries(names.map(name => [name, store.getResource(positionIri(name))?.data?.sortValue])),
      displayNumbers: () => names.map(name => store.getResource(positionIri(name))?.data?._metadata.sortDisplayNumber),
      stageServerValues: () => {
        for (const name of names) {
          store.saveResource({ resource: toResource(name, server[name]!), isNew: true, path: '/' })
        }
      },
      settle: async () => {
        for (let i = 0; i < 20; i++) {
          vi.advanceTimersByTime(1100)
          await Promise.resolve()
          await Promise.resolve()
          await Promise.resolve()
        }
      },
    }
  }

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test('a single move sends one request and ends matching the server', async () => {
    const failures: string[] = []
    for (let from = 0; from < 5; from++) {
      for (let to = 1; to <= 5; to++) {
        const group = createGroup({ a: 0, b: 3, c: 4, d: 10, e: 11 })
        const moved = group.displayed()[from]!
        group.move(moved, to)
        const shown = group.displayed()
        await group.settle()
        group.stageServerValues()
        const expectedRequests = from === to - 1 ? 0 : 1
        const result = { requests: group.requests.length, endpoint: group.requests[0]?.[0] ?? moved, displayed: group.displayed(), server: group.serverOrder(), pending: group.store.new.allIds.length }
        const expected = { requests: expectedRequests, endpoint: moved, displayed: shown, server: shown, pending: 0 }
        if (JSON.stringify(result) !== JSON.stringify(expected)) {
          failures.push(`${from}->${to}: ${JSON.stringify(result)}`)
        }
      }
    }
    expect(failures).toEqual([])
  })

  test('two positions moved within one window are both sent and land where displayed', async () => {
    const group = createGroup({ a: 0, b: 1, c: 2, d: 3, e: 4 })
    group.move('b', 'next')
    vi.advanceTimersByTime(300)
    group.move('e', 1)
    await group.settle()
    expect(group.requests).toHaveLength(2)
    expect(group.serverOrder()).toEqual(['e', 'a', 'c', 'b', 'd'])
    expect(group.displayed()).toEqual(['e', 'a', 'c', 'b', 'd'])
  })

  test('a failed reorder request leaves local sortValues untouched and the next move lands correctly', async () => {
    let fail = true
    const group = createGroup({ a: 0, b: 1, c: 2, d: 3 }, { failRequests: () => fail })
    group.move('d', 2)
    await group.settle()
    expect(group.localValues()).toEqual({ a: 0, b: 1, c: 2, d: 3 })
    expect(group.displayed()).toEqual(['a', 'b', 'c', 'd'])
    fail = false
    group.move('a', 3)
    await group.settle()
    expect(group.serverOrder()).toEqual(['b', 'c', 'a', 'd'])
    expect(group.displayed()).toEqual(['b', 'c', 'a', 'd'])
  })

  test('a reorder that sends no request clears every display number', async () => {
    const group = createGroup({ a: 0, b: 1, c: 2 })
    group.move('b', 'next')
    group.move('b', 'previous')
    await group.settle()
    expect(group.requests).toEqual([])
    expect(group.displayNumbers()).toEqual([undefined, undefined, undefined])
  })

  test('a move after another editor\'s reorder of the same group lands where displayed', async () => {
    const group = createGroup({ a: 0, b: 1, c: 2, d: 3 })
    Object.assign(group.server, { d: 0, a: 1, b: 2, c: 3 })
    group.stageServerValues()
    group.move('c', 2)
    const shown = group.displayed()
    await group.settle()
    expect(shown).toEqual(['a', 'c', 'b', 'd'])
    expect(group.serverOrder()).toEqual(shown)
    expect(group.displayed()).toEqual(shown)
    expect(group.localValues()).toEqual(group.server)
  })

  test('a move in a group holding duplicate sortValues lands where displayed', async () => {
    const group = createGroup({ a: 0, b: 1, c: 1, d: 2 })
    group.move('d', 3)
    await group.settle()
    expect(group.serverOrder()).toEqual(['a', 'b', 'd', 'c'])
    expect(group.displayed()).toEqual(['a', 'b', 'd', 'c'])
    expect(new Set(Object.values(group.server)).size).toBe(4)
    expect(group.requests.map(([name]) => name).filter(name => name === 'a' || name === 'b')).toEqual([])
  })

  test('local sortValues after moves equal the server\'s with gapped values', async () => {
    const group = createGroup({ a: 0, b: 3, c: 4, d: 10, e: 11 })
    group.move('e', 2)
    await group.settle()
    group.move('b', 5)
    await group.settle()
    group.move('a', 'next')
    await group.settle()
    expect(group.localValues()).toEqual(group.server)
  })

  test('an empty or non-numeric location is ignored', async () => {
    const group = createGroup({ a: 0, b: 1, c: 2 })
    group.move('c', '')
    group.move('c', 'abc')
    await group.settle()
    expect(group.displayNumbers()).toEqual([undefined, undefined, undefined])
    expect(group.requests).toEqual([])
    expect(group.displayed()).toEqual(['a', 'b', 'c'])
  })
})
