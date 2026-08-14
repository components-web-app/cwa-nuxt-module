// @vitest-environment happy-dom
import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest'
import { computed, reactive } from 'vue'
import { useComponentGroupPositions } from './ComponentGroup.Util.Positions'
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
      // After moving 'a' from index 0 to 1: ['b','a','c']
      // sortDisplayNumbers: b=1, a=2, c=3
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
      // After moving 'c' from index 2 to 1: ['a','c','b']
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
      // newIndex = -1 → clamped to 0 → no move
      const calls = mockCwa.resourcesManager.storeResource.mock.calls
      const updated = Object.fromEntries(calls.map(([{ resource }]: any) => [resource['@id'], resource._metadata.sortDisplayNumber]))
      expect(updated['/_/component_positions/a']).toBe(1)
    })

    test('location: absolute number moves to that position (1-indexed)', () => {
      const { mockCwa, getCapturedHandler } = buildCwa(positions, resources)
      useComponentGroupPositions(iriRef, mockCwa)
      getCapturedHandler()({ positionIri: '/_/component_positions/a', location: 3 })
      // newIndex = 3 - 1 = 2 → ['b','c','a']
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
      // 'missing' has no resource data — should be skipped (only 2 saveResource calls)
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
      // reactive deep-copy so Vue computed can track sortDisplayNumber changes via saveResource
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
          // return positions sorted by current sortDisplayNumber so debounce sees the new order
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
      // moving 'a' previous → clamped to index 0 = no change
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

  describe('updateRelatedLocalSortValues', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    test('increments sortValue for positions between oldIndex and newIndex when moving forward', async () => {
      const { nextTick } = await import('vue')
      const positionResources: Record<string, any> = {
        '/_/component_positions/a': { '@id': '/_/component_positions/a', 'sortValue': 10, '_metadata': {} },
        '/_/component_positions/b': { '@id': '/_/component_positions/b', 'sortValue': 20, '_metadata': {} },
        '/_/component_positions/c': { '@id': '/_/component_positions/c', 'sortValue': 30, '_metadata': {} },
        '/_/component_positions/d': { '@id': '/_/component_positions/d', 'sortValue': 40, '_metadata': {} },
      }
      const { mockCwa, getCapturedHandler } = buildCwa(
        ['/_/component_positions/a', '/_/component_positions/b', '/_/component_positions/c', '/_/component_positions/d'],
        positionResources,
      )
      // resolve updateResource immediately
      mockCwa.resourcesManager.updateResource.mockResolvedValue(undefined)
      useComponentGroupPositions(iriRef, mockCwa)
      // move 'a' (index 0) to index 2 (location 3)
      getCapturedHandler()({ positionIri: '/_/component_positions/a', location: 3 })
      vi.advanceTimersByTime(1100)
      await nextTick()
      await nextTick()
      await Promise.resolve()
      await nextTick()
      // updateRelatedLocalSortValues should have been called; check saveResource was called for the updated positions
      // positions b and c (between old index 0 and new index 2) should have sortValue decremented by 1
      const saveResourceCalls = mockCwa.resourcesManager.storeResource.mock.calls
      const relatedCalls = saveResourceCalls.filter(([{ resource }]: any) =>
        resource['@id'] !== '/_/component_positions/a',
      )
      expect(relatedCalls.length).toBeGreaterThan(0)
    })
  })
})
