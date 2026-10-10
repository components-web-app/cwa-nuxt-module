// @vitest-environment happy-dom
import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest'
import { computed, nextTick, reactive, ref } from 'vue'
import mitt from 'mitt'
import { createPinia, setActivePinia } from 'pinia'
import { useComponentGroupPositions } from './ComponentGroup.Util.Positions'
import { ComponentGroupReorders } from '#cwa/admin/component-group-reorder'
import { Resources } from '#cwa/resources/resources'
import { ResourcesStore } from '#cwa/storage/stores/resources/resources-store'
import { FetcherStore } from '#cwa/storage/stores/fetcher/fetcher-store'
import type { CwaResource } from '#cwa/resources/resource-utils'
import type { ReorderEvent } from '#cwa/admin/admin'

const unmountHooks = vi.hoisted(() => [] as Array<() => void>)

vi.mock('vue', async () => {
  const mod = await vi.importActual<typeof import('vue')>('vue')
  return {
    ...mod,
    onMounted: (fn: () => void) => fn(),
    onBeforeUnmount: (fn: () => void) => { unmountHooks.push(fn) },
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

  mockCwa.componentGroupReorders = new ComponentGroupReorders(mockCwa.admin, mockCwa.resources, mockCwa.resourcesManager)
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

      mockCwa.componentGroupReorders = new ComponentGroupReorders(mockCwa.admin, mockCwa.resources, mockCwa.resourcesManager)
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

  type GroupHarnessOptions = { failRequests?: () => boolean, holdRequests?: boolean }

  function createGroups(groups: Record<string, Record<string, number>>, options: GroupHarnessOptions = {}) {
    setActivePinia(createPinia())
    const resourcesStoreDef = new ResourcesStore('cwa')
    const store = resourcesStoreDef.useStore()
    const resources = new Resources(resourcesStoreDef, new FetcherStore('cwa'))
    const server: Record<string, number> = {}
    const groupOf: Record<string, string> = {}
    const requests: Array<[string, number]> = []
    const heldRequests: Array<() => void> = []
    let activeGroup = Object.keys(groups)[0]!
    const toResource = (name: string, sortValue: number) => ({ '@id': positionIri(name), '@type': 'ComponentPosition', 'componentGroup': groupOf[name], sortValue, '_metadata': {} } as unknown as CwaResource)
    for (const [group, initial] of Object.entries(groups)) {
      const names = Object.keys(initial)
      store.saveResource({ resource: { '@id': group, '@type': 'ComponentGroup', 'componentPositions': names.map(positionIri), '_metadata': {} } as unknown as CwaResource })
      for (const name of names) {
        server[name] = initial[name]!
        groupOf[name] = group
        store.saveResource({ resource: toResource(name, server[name]!) })
      }
    }
    const serverValuesOf = (group: string) => Object.fromEntries(Object.keys(groups[group]!).map(name => [name, server[name]!]))
    const mockCwa: any = {
      admin: {
        resourceStackManager: { getState: () => true, getClosestStackItemByType: () => activeGroup },
        eventBus: mitt(),
        emitRedraw: vi.fn(),
      },
      resources,
      resourcesManager: {
        storeResource: (event: any) => store.saveResource(event),
        updateResource: async (event: any) => {
          const name = nameOf(event.endpoint)
          requests.push([name, event.data.sortValue])
          if (options.holdRequests) {
            await new Promise<void>(resolve => heldRequests.push(resolve))
          }
          await Promise.resolve()
          if (options.failRequests?.()) {
            return undefined
          }
          const groupServer = serverValuesOf(groupOf[name]!)
          serverMove(groupServer, name, event.data.sortValue)
          Object.assign(server, groupServer)
          const response = toResource(name, server[name]!)
          store.saveResource({ resource: response })
          return response
        },
      },
    }
    mockCwa.componentGroupReorders = new ComponentGroupReorders(mockCwa.admin, mockCwa.resources, mockCwa.resourcesManager)
    const mount = (iri: { value: string | undefined } = computed(() => Object.keys(groups)[0])) => {
      const hooksBefore = unmountHooks.length
      useComponentGroupPositions(computed(() => iri.value), mockCwa)
      const hooks = unmountHooks.slice(hooksBefore)
      return { unmount: () => hooks.forEach(hook => hook()) }
    }
    const helpersFor = (group: string) => {
      const names = Object.keys(groups[group]!)
      return {
        serverOrder: () => [...names].sort((a, b) => server[a]! - server[b]!),
        move: (name: string, location: any) => {
          activeGroup = group
          mockCwa.admin.eventBus.emit('reorder', { positionIri: positionIri(name), location })
        },
        displayed: () => store.getOrderedPositionsForGroup(group)!.map(nameOf),
        localValues: () => Object.fromEntries(names.map(name => [name, store.getResource(positionIri(name))?.data?.sortValue])),
        displayNumbers: () => names.map(name => store.getResource(positionIri(name))?.data?._metadata.sortDisplayNumber),
        stageServerValues: () => {
          for (const name of names) {
            store.saveResource({ resource: toResource(name, server[name]!), isNew: true, path: '/' })
          }
        },
      }
    }
    return {
      store,
      server,
      requests,
      mount,
      group: helpersFor,
      releaseRequests: () => heldRequests.splice(0).forEach(resolve => resolve()),
      flushMicrotasks: async () => {
        for (let i = 0; i < 10; i++) {
          await Promise.resolve()
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

  function createGroup(initial: Record<string, number>, options: GroupHarnessOptions = {}) {
    const harness = createGroups({ [groupIri]: initial }, options)
    harness.mount()
    return { ...harness, ...harness.group(groupIri) }
  }

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    unmountHooks.splice(0)
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

  describe('a group mounted more than once', () => {
    test('Move up applies once and sends one request', async () => {
      const harness = createGroups({ [groupIri]: { a: 0, b: 1, c: 2 } })
      const group = harness.group(groupIri)
      harness.mount()
      harness.mount()
      group.move('c', 'previous')
      expect(group.displayed()).toEqual(['a', 'c', 'b'])
      await harness.settle()
      expect(harness.requests).toHaveLength(1)
      expect(group.serverOrder()).toEqual(['a', 'c', 'b'])
      expect(group.displayed()).toEqual(['a', 'c', 'b'])
    })

    test('Move down applies once and sends one request', async () => {
      const harness = createGroups({ [groupIri]: { a: 0, b: 1, c: 2 } })
      const group = harness.group(groupIri)
      harness.mount()
      harness.mount()
      group.move('a', 'next')
      expect(group.displayed()).toEqual(['b', 'a', 'c'])
      await harness.settle()
      expect(harness.requests).toHaveLength(1)
      expect(group.serverOrder()).toEqual(['b', 'a', 'c'])
      expect(group.displayed()).toEqual(['b', 'a', 'c'])
    })

    test('a numbered move sends one request', async () => {
      const harness = createGroups({ [groupIri]: { a: 0, b: 1, c: 2 } })
      const group = harness.group(groupIri)
      harness.mount()
      harness.mount()
      group.move('c', 2)
      expect(group.displayed()).toEqual(['a', 'c', 'b'])
      await harness.settle()
      expect(harness.requests).toHaveLength(1)
      expect(group.serverOrder()).toEqual(['a', 'c', 'b'])
      expect(group.displayed()).toEqual(['a', 'c', 'b'])
    })

    test('a move pending when the last instance unmounts is sent, and a later move waits for it', async () => {
      const harness = createGroups({ [groupIri]: { a: 0, b: 1, c: 2, d: 3 } }, { holdRequests: true })
      const group = harness.group(groupIri)
      const first = harness.mount()
      const second = harness.mount()
      group.move('d', 1)
      first.unmount()
      second.unmount()
      await harness.flushMicrotasks()
      expect(harness.requests).toEqual([['d', 0]])
      harness.mount()
      group.move('a', 'next')
      expect(group.displayed()).toEqual(['d', 'b', 'a', 'c'])
      vi.advanceTimersByTime(1100)
      await harness.flushMicrotasks()
      expect(harness.requests).toHaveLength(1)
      for (let i = 0; i < 5; i++) {
        harness.releaseRequests()
        await harness.settle()
      }
      expect(harness.requests).toHaveLength(2)
      expect(group.serverOrder()).toEqual(['d', 'b', 'a', 'c'])
      expect(group.displayed()).toEqual(['d', 'b', 'a', 'c'])
      expect(group.displayNumbers()).toEqual([undefined, undefined, undefined, undefined])
    })

    test('a group whose IRI resolves after mounting handles each move once', async () => {
      const harness = createGroups({ [groupIri]: { a: 0, b: 1, c: 2 } })
      const group = harness.group(groupIri)
      const lateIri = ref<string | undefined>(undefined)
      harness.mount(lateIri)
      group.move('c', 'previous')
      expect(group.displayed()).toEqual(['a', 'b', 'c'])
      lateIri.value = groupIri
      await nextTick()
      group.move('c', 'previous')
      expect(group.displayed()).toEqual(['a', 'c', 'b'])
      harness.mount()
      group.move('a', 'next')
      expect(group.displayed()).toEqual(['c', 'a', 'b'])
      await harness.settle()
      expect(harness.requests).toHaveLength(1)
      expect(group.serverOrder()).toEqual(['c', 'a', 'b'])
    })
  })

  test('moves in one group leave another mounted group untouched', async () => {
    const otherGroupIri = '/_/component_groups/h'
    const harness = createGroups({ [groupIri]: { a: 0, b: 1, c: 2 }, [otherGroupIri]: { x: 0, y: 1, z: 2 } })
    const group = harness.group(groupIri)
    const otherGroup = harness.group(otherGroupIri)
    harness.mount()
    harness.mount(computed(() => otherGroupIri))
    otherGroup.move('z', 'previous')
    expect(otherGroup.displayed()).toEqual(['x', 'z', 'y'])
    expect(group.displayNumbers()).toEqual([undefined, undefined, undefined])
    await harness.settle()
    expect(harness.requests.map(([name]) => name)).toEqual(['z'])
    expect(otherGroup.serverOrder()).toEqual(['x', 'z', 'y'])
    expect(group.serverOrder()).toEqual(['a', 'b', 'c'])
    expect(group.displayed()).toEqual(['a', 'b', 'c'])
  })
})
