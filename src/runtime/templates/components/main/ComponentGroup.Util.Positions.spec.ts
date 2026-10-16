// @vitest-environment happy-dom
import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest'
import { computed, nextTick, ref } from 'vue'
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
      queueComponentGroupWrite: vi.fn((_group: string, write: () => Promise<unknown>) => write()),
      orderComponentGroup: vi.fn().mockResolvedValue(true),
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
})

function orderServerValues(values: Record<string, number | undefined>, order: string[]): Record<string, number> {
  const offsets = order.map((name, index) => {
    const value = values[name]
    return value === undefined || value - index < 0 ? undefined : value - index
  })
  const lengths: number[] = []
  const previous: number[] = []
  let best = -1
  for (let i = 0; i < order.length; i++) {
    lengths[i] = 0
    previous[i] = -1
    if (offsets[i] === undefined) {
      continue
    }
    lengths[i] = 1
    for (let j = 0; j < i; j++) {
      if (offsets[j] !== undefined && offsets[j]! <= offsets[i]! && lengths[j]! + 1 > lengths[i]!) {
        lengths[i] = lengths[j]! + 1
        previous[i] = j
      }
    }
    if (best === -1 || lengths[i]! > lengths[best]!) {
      best = i
    }
  }
  const kept = new Set<number>()
  for (let i = best; i !== -1; i = previous[i]!) {
    kept.add(i)
  }
  const result: Record<string, number> = {}
  const keptIndexes = [...kept].sort((a, b) => a - b)
  if (!keptIndexes.length) {
    order.forEach((name, index) => {
      result[name] = index
    })
    return result
  }
  const first = keptIndexes[0]!
  for (let i = 0; i < first; i++) {
    result[order[i]!] = values[order[first]!]! - (first - i)
  }
  let last = first
  for (const index of keptIndexes) {
    result[order[index]!] = values[order[index]!]!
    for (let i = last + 1; i < index; i++) {
      result[order[i]!] = values[order[last]!]! + (i - last)
    }
    last = index
  }
  for (let i = last + 1; i < order.length; i++) {
    result[order[i]!] = values[order[last]!]! + (i - last)
  }
  return result
}

const byServerOrder = (values: Record<string, number>) => (a: string, b: string) => values[a]! === values[b]! ? (a < b ? -1 : 1) : values[a]! - values[b]!

function serverOrderRequest(values: Record<string, number>, listed: string[]): Record<string, number> {
  const current = Object.keys(values).sort(byServerOrder(values))
  const present = listed.filter(name => name in values)
  const order = [...present]
  for (const [index, name] of current.entries()) {
    if (present.includes(name)) {
      continue
    }
    const predecessor = current.slice(0, index).reverse().find(other => order.includes(other))
    order.splice(predecessor === undefined ? 0 : order.indexOf(predecessor) + 1, 0, name)
  }
  return orderServerValues(values, order)
}

describe('the fake server orders as api-components-bundle#475 specifies', () => {
  const values = (spec: string) => Object.fromEntries(spec.split(' ').map(entry => [entry[0]!, Number(entry.slice(1))]))
  const insert = (start: string, anchor: { after?: string, before?: string }) => {
    const current = values(start)
    const order = Object.keys(current).sort(byServerOrder(current))
    const at = anchor.after ? order.indexOf(anchor.after) + 1 : anchor.before ? order.indexOf(anchor.before) : order.length
    order.splice(at, 0, 'N')
    return orderServerValues(current, order)
  }

  test.each([
    ['1', 'A0 B10 C20', { after: 'A' }, { A: 0, N: 1, B: 10, C: 20 }],
    ['2', 'A0 B1 C2', { after: 'A' }, { A: 0, N: 1, B: 2, C: 3 }],
    ['3', 'A0 B1 C2 D10', { after: 'A' }, { A: 0, N: 1, B: 2, C: 3, D: 10 }],
    ['4', 'A0 B1', { before: 'A' }, { N: 0, A: 1, B: 2 }],
    ['5', 'A0 B10', {}, { A: 0, B: 10, N: 11 }],
    ['6', 'A5 B5', { after: 'A' }, { A: 5, N: 6, B: 7 }],
    ['7', 'A5 B5', { before: 'B' }, { A: 5, N: 6, B: 7 }],
  ])('insert case %s', (_case, start, anchor, expected) => {
    expect(insert(start, anchor)).toEqual(expected)
  })

  test.each([
    ['11', 'A0 B10 C20', ['B', 'A', 'C'], { B: 10, A: 11, C: 20 }],
    ['12', 'A0 B1 C2', ['C', 'A', 'B'], { C: 2, A: 3, B: 4 }],
    ['13', 'A5 B5 C5', ['A', 'B', 'C'], { A: 5, B: 6, C: 7 }],
  ])('order case %s', (_case, start, order, expected) => {
    expect(serverOrderRequest(values(start), order)).toEqual(expected)
  })

  test('case 14: an unlisted position keeps following its predecessor', () => {
    const result = serverOrderRequest(values('A0 H10 B20'), ['B', 'A'])
    expect(Object.keys(result).sort(byServerOrder(result))).toEqual(['B', 'A', 'H'])
  })
})

describe('group reorder queue against the server (#400, api-components-bundle#475)', () => {
  const groupIri = '/_/component_groups/g'
  const positionIri = (name: string) => `/_/component_positions/${name}`
  const nameOf = (iri: string) => iri.split('/').pop()!

  type GroupHarnessOptions = { failRequests?: () => boolean, holdRequests?: boolean, hidden?: string[] }

  function createGroups(groups: Record<string, Record<string, number>>, options: GroupHarnessOptions = {}) {
    setActivePinia(createPinia())
    const resourcesStoreDef = new ResourcesStore('cwa')
    const store = resourcesStoreDef.useStore()
    const resources = new Resources(resourcesStoreDef, new FetcherStore('cwa'))
    const server: Record<string, number> = {}
    const groupOf: Record<string, string> = {}
    const requests: Array<[string, string[]]> = []
    const heldRequests: Array<() => void> = []
    const groupWrites: Record<string, Promise<unknown>> = {}
    let activeGroup = Object.keys(groups)[0]!
    const toResource = (name: string, sortValue: number) => ({ '@id': positionIri(name), '@type': 'ComponentPosition', 'componentGroup': groupOf[name], sortValue, '_metadata': {} } as unknown as CwaResource)
    for (const [group, initial] of Object.entries(groups)) {
      const names = Object.keys(initial)
      store.saveResource({ resource: { '@id': group, '@type': 'ComponentGroup', 'componentPositions': names.filter(name => !options.hidden?.includes(name)).map(positionIri), '_metadata': {} } as unknown as CwaResource })
      for (const name of names) {
        server[name] = initial[name]!
        groupOf[name] = group
        if (!options.hidden?.includes(name)) {
          store.saveResource({ resource: toResource(name, server[name]!) })
        }
      }
    }
    const namesOf = (group: string) => Object.keys(groups[group]!)
    const serverValuesOf = (group: string) => Object.fromEntries(namesOf(group).map(name => [name, server[name]!]))
    const mockCwa: any = {
      admin: {
        resourceStackManager: { getState: () => true, getClosestStackItemByType: () => activeGroup },
        eventBus: mitt(),
        emitRedraw: vi.fn(),
      },
      resources,
      resourcesManager: {
        storeResource: (event: any) => store.saveResource(event),
        queueComponentGroupWrite: (group: string, write: () => Promise<unknown>) => {
          const next = (groupWrites[group] ?? Promise.resolve()).then(write)
          groupWrites[group] = next.catch(() => undefined)
          return next
        },
        orderComponentGroup: async (group: string, iris: string[]) => {
          const listed = iris.map(nameOf)
          requests.push([group, listed])
          if (options.holdRequests) {
            await new Promise<void>(resolve => heldRequests.push(resolve))
          }
          await Promise.resolve()
          if (options.failRequests?.()) {
            return false
          }
          Object.assign(server, serverOrderRequest(serverValuesOf(group), listed))
          for (const name of listed) {
            const stored = store.getResource(positionIri(name))?.data
            if (stored) {
              store.saveResource({ resource: { ...stored, sortValue: server[name]! } })
            }
          }
          return true
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
      const names = namesOf(group).filter(name => !options.hidden?.includes(name))
      return {
        serverOrder: () => namesOf(group).sort(byServerOrder(server)),
        move: (name: string, location: any) => {
          activeGroup = group
          mockCwa.admin.eventBus.emit('reorder', { positionIri: positionIri(name), location })
        },
        displayed: () => store.getOrderedPositionsForGroup(group)!.map(nameOf),
        localValues: () => Object.fromEntries(names.map(name => [name, store.getResource(positionIri(name))?.data?.sortValue])),
        serverValues: () => Object.fromEntries(names.map(name => [name, server[name]])),
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
      queueWrite: (group: string, write: () => Promise<unknown>) => mockCwa.resourcesManager.queueComponentGroupWrite(group, write),
      releaseRequests: () => heldRequests.splice(0).forEach(resolve => resolve()),
      settle: async () => {
        for (let i = 0; i < 30; i++) {
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

  afterEach(() => {
    unmountHooks.splice(0)
  })

  test('every single move sends one order request at once and ends with the server\'s values and order', async () => {
    const failures: string[] = []
    for (let from = 0; from < 5; from++) {
      for (let to = 1; to <= 5; to++) {
        const group = createGroup({ a: 0, b: 3, c: 4, d: 10, e: 11 })
        const moved = group.displayed()[from]!
        group.move(moved, to)
        const shown = group.displayed()
        await group.settle()
        const expectedRequests = from === to - 1 ? 0 : 1
        const result = { requests: group.requests.length, listed: group.requests[0]?.[1] ?? shown, displayed: group.displayed(), server: group.serverOrder(), values: group.localValues() }
        const expected = { requests: expectedRequests, listed: shown, displayed: shown, server: shown, values: group.serverValues() }
        if (JSON.stringify(result) !== JSON.stringify(expected)) {
          failures.push(`${from}->${to}: ${JSON.stringify(result)}`)
        }
      }
    }
    expect(failures).toEqual([])
  })

  test('case 11: the stored values are the server\'s, changing only the moved position', async () => {
    const group = createGroup({ a: 0, b: 10, c: 20 })
    group.move('b', 1)
    await group.settle()
    expect(group.requests).toEqual([[groupIri, ['b', 'a', 'c']]])
    expect(group.localValues()).toEqual({ a: 11, b: 10, c: 20 })
    expect(group.displayed()).toEqual(['b', 'a', 'c'])
  })

  test('moves made while a request is in flight go in one more request with the newest order', async () => {
    const group = createGroup({ a: 0, b: 1, c: 2, d: 3 }, { holdRequests: true })
    group.move('d', 1)
    await group.settle()
    group.move('c', 1)
    group.move('a', 'next')
    expect(group.displayed()).toEqual(['c', 'd', 'b', 'a'])
    await group.settle()
    expect(group.requests).toEqual([[groupIri, ['d', 'a', 'b', 'c']]])
    group.releaseRequests()
    await group.settle()
    expect(group.requests).toEqual([
      [groupIri, ['d', 'a', 'b', 'c']],
      [groupIri, ['c', 'd', 'b', 'a']],
    ])
    group.releaseRequests()
    await group.settle()
    expect(group.serverOrder()).toEqual(['c', 'd', 'b', 'a'])
    expect(group.displayed()).toEqual(['c', 'd', 'b', 'a'])
    expect(group.displayNumbers()).toEqual([undefined, undefined, undefined, undefined])
  })

  test('the screen keeps the editor\'s newest order while an older order\'s response is stored', async () => {
    const group = createGroup({ a: 0, b: 1, c: 2 }, { holdRequests: true })
    group.move('c', 1)
    await group.settle()
    group.move('a', 3)
    group.releaseRequests()
    await group.settle()
    expect(group.serverOrder()).toEqual(['c', 'a', 'b'])
    expect(group.displayed()).toEqual(['c', 'b', 'a'])
    group.releaseRequests()
    await group.settle()
    expect(group.displayed()).toEqual(['c', 'b', 'a'])
    expect(group.serverOrder()).toEqual(['c', 'b', 'a'])
  })

  test('an order request waits for another write to the group, such as an insert, to finish', async () => {
    const group = createGroup({ a: 0, b: 1, c: 2 })
    let finishInsert!: () => void
    group.queueWrite(groupIri, () => new Promise<void>((resolve) => {
      finishInsert = resolve
    }))
    group.move('c', 1)
    await group.settle()
    expect(group.requests).toEqual([])
    finishInsert()
    await group.settle()
    expect(group.requests).toEqual([[groupIri, ['c', 'a', 'b']]])
  })

  test('a failed order request shows the server\'s order again, and the next move still works', async () => {
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

  test('a move undone while its request is in flight sends the original order back and clears every display number', async () => {
    const group = createGroup({ a: 0, b: 1, c: 2 }, { holdRequests: true })
    group.move('b', 'next')
    await group.settle()
    group.move('b', 'previous')
    group.releaseRequests()
    await group.settle()
    group.releaseRequests()
    await group.settle()
    expect(group.requests).toEqual([[groupIri, ['a', 'c', 'b']], [groupIri, ['a', 'b', 'c']]])
    expect(group.displayNumbers()).toEqual([undefined, undefined, undefined])
    expect(group.displayed()).toEqual(['a', 'b', 'c'])
  })

  test('a move that changes nothing sends no request', async () => {
    const group = createGroup({ a: 0, b: 1, c: 2 })
    group.move('a', 'previous')
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
    expect(group.localValues()).toEqual(group.serverValues())
  })

  test('a group holding duplicate sortValues is shown in the server\'s tie order and a move lands where displayed', async () => {
    const group = createGroup({ a: 0, c: 1, b: 1, d: 2 })
    expect(group.displayed()).toEqual(['a', 'b', 'c', 'd'])
    group.move('d', 3)
    await group.settle()
    expect(group.serverOrder()).toEqual(['a', 'b', 'd', 'c'])
    expect(group.displayed()).toEqual(['a', 'b', 'd', 'c'])
    expect(new Set(Object.values(group.server)).size).toBe(4)
  })

  test('case 14: a position hidden from the module is not listed and keeps its place on the server', async () => {
    const group = createGroup({ a: 0, h: 10, b: 20 }, { hidden: ['h'] })
    group.move('b', 1)
    await group.settle()
    expect(group.requests).toEqual([[groupIri, ['b', 'a']]])
    expect(group.serverOrder()).toEqual(['b', 'a', 'h'])
    expect(group.displayed()).toEqual(['b', 'a'])
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
    test.each([
      ['Move up', 'c', 'previous', ['a', 'c', 'b']],
      ['Move down', 'a', 'next', ['b', 'a', 'c']],
      ['a numbered move', 'c', 2, ['a', 'c', 'b']],
    ])('%s applies once and sends one request', async (_label, name, location, expected) => {
      const harness = createGroups({ [groupIri]: { a: 0, b: 1, c: 2 } })
      const group = harness.group(groupIri)
      harness.mount()
      harness.mount()
      group.move(name, location)
      expect(group.displayed()).toEqual(expected)
      await harness.settle()
      expect(harness.requests).toHaveLength(1)
      expect(group.serverOrder()).toEqual(expected)
      expect(group.displayed()).toEqual(expected)
    })

    test('a move in flight when the last instance unmounts still lands, and a later move follows it', async () => {
      const harness = createGroups({ [groupIri]: { a: 0, b: 1, c: 2, d: 3 } }, { holdRequests: true })
      const group = harness.group(groupIri)
      const first = harness.mount()
      const second = harness.mount()
      group.move('d', 1)
      first.unmount()
      second.unmount()
      await harness.settle()
      expect(harness.requests).toEqual([[groupIri, ['d', 'a', 'b', 'c']]])
      harness.mount()
      group.move('a', 'next')
      expect(group.displayed()).toEqual(['d', 'b', 'a', 'c'])
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
      const harness = createGroups({ [groupIri]: { a: 0, b: 1, c: 2 } }, { holdRequests: true })
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
      for (let i = 0; i < 5; i++) {
        harness.releaseRequests()
        await harness.settle()
      }
      expect(harness.requests).toEqual([[groupIri, ['c', 'a', 'b']]])
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
    expect(harness.requests).toEqual([[otherGroupIri, ['x', 'z', 'y']]])
    expect(otherGroup.serverOrder()).toEqual(['x', 'z', 'y'])
    expect(group.serverOrder()).toEqual(['a', 'b', 'c'])
    expect(group.displayed()).toEqual(['a', 'b', 'c'])
  })
})
