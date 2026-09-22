import { computed, onBeforeUnmount, onMounted } from 'vue'
import type { ComputedRef } from 'vue'
import debounce from 'lodash-es/debounce'
import { CwaResourceTypes } from '#cwa/resources/resource-utils'
import type { CwaResource } from '#cwa/resources/resource-utils'
import { NEW_RESOURCE_IRI } from '#cwa/storage/stores/resources/state'
import type Cwa from '#cwa/cwa'
import type { ReorderEvent } from '#cwa/admin/admin'

const moveElement = (array: string[], fromIndex: number, toIndex: number) => {
  const startIndex = fromIndex < 0 ? array.length + fromIndex : fromIndex

  if (startIndex >= 0 && startIndex < array.length) {
    const endIndex = toIndex < 0 ? array.length + toIndex : toIndex

    const [item] = array.splice(fromIndex, 1)
    if (item) array.splice(endIndex, 0, item)
  }
}

const unmovedSubsequence = (baseIndexes: number[], preferMove: boolean[]): Set<number> => {
  const weight = (index: number) => baseIndexes.length + 1 + (preferMove[index] ? 0 : 1)
  const scores: number[] = []
  const previous: number[] = []
  let best = -1
  for (let i = 0; i < baseIndexes.length; i++) {
    scores[i] = weight(i)
    previous[i] = -1
    for (let j = 0; j < i; j++) {
      if (baseIndexes[j]! < baseIndexes[i]! && scores[j]! + weight(i) > scores[i]!) {
        scores[i] = scores[j]! + weight(i)
        previous[i] = j
      }
    }
    if (best === -1 || scores[i]! > scores[best]!) {
      best = i
    }
  }
  const kept = new Set<number>()
  for (let i = best; i !== -1; i = previous[i]!) {
    kept.add(i)
  }
  return kept
}

const resolveNewIndex = (location: ReorderEvent['location'], currentIndex: number): number | undefined => {
  if (location === 'next') {
    return currentIndex + 1
  }
  if (location === 'previous') {
    return Math.max(currentIndex - 1, 0)
  }
  const numericLocation = Number(location)
  if (String(location).trim() === '' || !Number.isFinite(numericLocation)) {
    return
  }
  return Math.max(numericLocation - 1, 0)
}

export const useComponentGroupPositions = (iri: ComputedRef<string | undefined>, $cwa: Cwa) => {
  const groupIsReordering = computed(() => {
    if (!iri.value || !$cwa.admin.resourceStackManager.getState('reordering')) {
      return false
    }
    // look for the earliest component group and if this is the deepest nested one, we enable reordering
    return $cwa.admin.resourceStackManager.getClosestStackItemByType(CwaResourceTypes.COMPONENT_GROUP) === iri.value
  })

  const componentPositions = computed(() => {
    return iri.value ? $cwa.resources.getOrderedPositionsForGroup(iri.value) : undefined
  })

  let reorderGeneration = 0
  let movedIris = new Set<string>()
  let syncQueue: Promise<void> = Promise.resolve()

  const getPosition = (positionIri: string): CwaResource | undefined => $cwa.resources.getResource(positionIri).value?.data

  const sortValueOf = (positionIri: string): number => getPosition(positionIri)?.sortValue as number

  const persistedPositions = (): string[] => (componentPositions.value || []).filter((positionIri) => {
    return !positionIri.endsWith(NEW_RESOURCE_IRI) && typeof getPosition(positionIri)?.sortValue === 'number'
  })

  const sortValueOrder = (positionIris: string[]): string[] => [...positionIris].sort((a, b) => sortValueOf(a) - sortValueOf(b))

  function storeSortValue(positionIri: string, sortValue: number) {
    const position = getPosition(positionIri)
    if (!position) {
      return
    }
    $cwa.resourcesManager.storeResource({
      resource: { ...position, sortValue },
    })
  }

  function clearDisplayNumbers() {
    for (const positionIri of componentPositions.value || []) {
      const position = getPosition(positionIri)
      if (positionIri.endsWith(NEW_RESOURCE_IRI) || !position || position._metadata.sortDisplayNumber === undefined) {
        continue
      }
      $cwa.resourcesManager.storeResource({
        resource: {
          ...position,
          _metadata: {
            ...position._metadata,
            sortDisplayNumber: undefined,
          },
        },
      })
    }
  }

  type PendingPosition = { positionIri: string, resource: CwaResource, path?: string }

  function collectPendingPositions(positionIris: string[]): PendingPosition[] {
    const pendingPositions: PendingPosition[] = []
    for (const positionIri of positionIris) {
      const pending = $cwa.resources.getPendingResource(positionIri)
      if (pending?.resource) {
        pendingPositions.push({ positionIri, resource: pending.resource, path: pending.path })
      }
    }
    return pendingPositions
  }

  function applyPendingSortValues(pendingPositions: PendingPosition[]) {
    for (const { positionIri, resource, path } of pendingPositions) {
      if (typeof resource.sortValue === 'number' && resource.sortValue !== sortValueOf(positionIri)) {
        storeSortValue(positionIri, resource.sortValue)
      }
      $cwa.resourcesManager.storeResource({
        resource,
        isNew: true,
        path,
      })
    }
  }

  function mirrorServerMove(movedIri: string, originalSortValue: number, moveTo: number) {
    if (moveTo === originalSortValue) {
      return
    }
    for (const positionIri of persistedPositions()) {
      if (positionIri === movedIri) {
        continue
      }
      const sortValue = sortValueOf(positionIri)
      if (moveTo > originalSortValue && sortValue > originalSortValue && sortValue <= moveTo) {
        storeSortValue(positionIri, sortValue - 1)
      }
      else if (moveTo < originalSortValue && sortValue < originalSortValue && sortValue >= moveTo) {
        storeSortValue(positionIri, sortValue + 1)
      }
    }
  }

  async function sendMove(positionIri: string, moveTo: number): Promise<boolean> {
    const originalSortValue = sortValueOf(positionIri)
    const response = await $cwa.resourcesManager.updateResource({
      endpoint: positionIri,
      data: {
        sortValue: moveTo,
      },
    })
    if (!response) {
      return false
    }
    storeSortValue(positionIri, moveTo)
    mirrorServerMove(positionIri, originalSortValue, moveTo)
    return true
  }

  async function repairDuplicateSortValues(positionIris: string[]): Promise<boolean> {
    const repairs: Array<[string, number]> = []
    let previousSortValue: number | undefined
    for (const positionIri of sortValueOrder(positionIris)) {
      const sortValue = sortValueOf(positionIri)
      const repairedSortValue = previousSortValue === undefined || sortValue > previousSortValue ? sortValue : previousSortValue + 1
      if (repairedSortValue !== sortValue) {
        repairs.push([positionIri, repairedSortValue])
      }
      previousSortValue = repairedSortValue
    }
    for (const [positionIri, repairedSortValue] of repairs.reverse()) {
      if (!await sendMove(positionIri, repairedSortValue)) {
        return false
      }
    }
    return true
  }

  async function sendMoves(desiredOrder: string[], moved: Set<string>): Promise<boolean> {
    let workingOrder = sortValueOrder(desiredOrder)
    const kept = unmovedSubsequence(
      desiredOrder.map(positionIri => workingOrder.indexOf(positionIri)),
      desiredOrder.map(positionIri => moved.has(positionIri)),
    )
    for (const [index, positionIri] of desiredOrder.entries()) {
      if (kept.has(index)) {
        continue
      }
      const withoutPosition = workingOrder.filter(workingIri => workingIri !== positionIri)
      const targetIndex = index === 0 ? 0 : withoutPosition.indexOf(desiredOrder[index - 1]!) + 1
      const displacedIri = workingOrder[targetIndex]
      if (!displacedIri || displacedIri === positionIri) {
        continue
      }
      if (!await sendMove(positionIri, sortValueOf(displacedIri))) {
        return false
      }
      withoutPosition.splice(targetIndex, 0, positionIri)
      workingOrder = withoutPosition
    }
    return true
  }

  async function syncGroupOrder() {
    const startGeneration = reorderGeneration
    const moved = movedIris
    movedIris = new Set()
    const desiredOrder = persistedPositions()
    applyPendingSortValues(collectPendingPositions(desiredOrder))
    const synced = await repairDuplicateSortValues(desiredOrder) && await sendMoves(desiredOrder, moved)
    if (!synced) {
      scheduleSync.cancel()
      movedIris = new Set()
      clearDisplayNumbers()
      return
    }
    if (startGeneration === reorderGeneration) {
      clearDisplayNumbers()
    }
  }

  const scheduleSync = debounce(() => {
    syncQueue = syncQueue.then(syncGroupOrder).catch(clearDisplayNumbers)
  }, 1000)

  function handleReorderEvent(event: ReorderEvent) {
    if (!groupIsReordering.value || !componentPositions.value) {
      return
    }

    const currentIndex = componentPositions.value.indexOf(event.positionIri)
    if (currentIndex === -1) {
      return
    }

    const newIndex = resolveNewIndex(event.location, currentIndex)
    if (newIndex === undefined) {
      return
    }

    const pendingPositions = collectPendingPositions(persistedPositions())
    const positionCopy = [...componentPositions.value]
    moveElement(positionCopy, currentIndex, newIndex)
    for (const [index, iri] of positionCopy.entries()) {
      const currentResource = $cwa.resources.getResource(iri).value?.data
      if (!currentResource) {
        continue
      }
      currentResource._metadata.sortDisplayNumber = index + 1
      $cwa.resourcesManager.storeResource({
        resource: currentResource,
      })
    }

    applyPendingSortValues(pendingPositions)

    $cwa.admin.emitRedraw()

    reorderGeneration++
    movedIris.add(event.positionIri)
    scheduleSync()
  }

  onMounted(() => {
    $cwa.admin.eventBus.on('reorder', handleReorderEvent)
  })

  onBeforeUnmount(() => {
    $cwa.admin.eventBus.off('reorder', handleReorderEvent)
  })

  return {
    groupIsReordering,
    componentPositions,
  }
}
