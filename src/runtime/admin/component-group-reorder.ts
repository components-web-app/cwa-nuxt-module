import debounce from 'lodash-es/debounce'
import { CwaResourceTypes } from '#cwa/resources/resource-utils'
import type { CwaResource } from '#cwa/resources/resource-utils'
import { NEW_RESOURCE_IRI } from '#cwa/storage/stores/resources/state'
import type { Resources } from '#cwa/resources/resources'
import type { ResourcesManager } from '#cwa/resources/resources-manager'
import type Admin from './admin'
import type { ReorderEvent } from './admin'

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

type PendingPosition = { positionIri: string, resource: CwaResource, path?: string }

class GroupReorder {
  public mounts = 0
  private reorderGeneration = 0
  private movedIris = new Set<string>()
  private syncQueue: Promise<void> = Promise.resolve()
  private readonly scheduleSync = debounce(() => {
    this.syncQueue = this.syncQueue.then(() => this.syncGroupOrder()).catch(() => this.clearDisplayNumbers())
  }, 1000)

  public constructor(
    private readonly iri: string,
    private readonly admin: Admin,
    private readonly resources: Resources,
    private readonly resourcesManager: ResourcesManager,
  ) {
    this.handleReorderEvent = this.handleReorderEvent.bind(this)
  }

  public flush(): Promise<void> {
    this.scheduleSync.flush()
    return this.syncQueue
  }

  public handleReorderEvent(event: ReorderEvent) {
    const componentPositions = this.componentPositions()
    if (!this.isReordering() || !componentPositions) {
      return
    }

    const currentIndex = componentPositions.indexOf(event.positionIri)
    if (currentIndex === -1) {
      return
    }

    const newIndex = resolveNewIndex(event.location, currentIndex)
    if (newIndex === undefined) {
      return
    }

    const pendingPositions = this.collectPendingPositions(this.persistedPositions())
    const positionCopy = [...componentPositions]
    moveElement(positionCopy, currentIndex, newIndex)
    for (const [index, iri] of positionCopy.entries()) {
      const currentResource = this.resources.getResource(iri).value?.data
      if (!currentResource) {
        continue
      }
      currentResource._metadata.sortDisplayNumber = index + 1
      this.resourcesManager.storeResource({
        resource: currentResource,
      })
    }

    this.applyPendingSortValues(pendingPositions)

    this.admin.emitRedraw()

    this.reorderGeneration++
    this.movedIris.add(event.positionIri)
    this.scheduleSync()
  }

  private isReordering() {
    return !!this.admin.resourceStackManager.getState('reordering')
      && this.admin.resourceStackManager.getClosestStackItemByType(CwaResourceTypes.COMPONENT_GROUP) === this.iri
  }

  private componentPositions(): string[] | undefined {
    return this.resources.getOrderedPositionsForGroup(this.iri)
  }

  private getPosition(positionIri: string): CwaResource | undefined {
    return this.resources.getResource(positionIri).value?.data
  }

  private sortValueOf(positionIri: string): number {
    return this.getPosition(positionIri)?.sortValue as number
  }

  private persistedPositions(): string[] {
    return (this.componentPositions() || []).filter((positionIri) => {
      return !positionIri.endsWith(NEW_RESOURCE_IRI) && typeof this.getPosition(positionIri)?.sortValue === 'number'
    })
  }

  private sortValueOrder(positionIris: string[]): string[] {
    return [...positionIris].sort((a, b) => this.sortValueOf(a) - this.sortValueOf(b))
  }

  private storeSortValue(positionIri: string, sortValue: number) {
    const position = this.getPosition(positionIri)
    if (!position) {
      return
    }
    this.resourcesManager.storeResource({
      resource: { ...position, sortValue },
    })
  }

  private clearDisplayNumbers() {
    for (const positionIri of this.componentPositions() || []) {
      const position = this.getPosition(positionIri)
      if (positionIri.endsWith(NEW_RESOURCE_IRI) || !position || position._metadata.sortDisplayNumber === undefined) {
        continue
      }
      this.resourcesManager.storeResource({
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

  private collectPendingPositions(positionIris: string[]): PendingPosition[] {
    const pendingPositions: PendingPosition[] = []
    for (const positionIri of positionIris) {
      const pending = this.resources.getPendingResource(positionIri)
      if (pending?.resource) {
        pendingPositions.push({ positionIri, resource: pending.resource, path: pending.path })
      }
    }
    return pendingPositions
  }

  private applyPendingSortValues(pendingPositions: PendingPosition[]) {
    for (const { positionIri, resource, path } of pendingPositions) {
      if (typeof resource.sortValue === 'number' && resource.sortValue !== this.sortValueOf(positionIri)) {
        this.storeSortValue(positionIri, resource.sortValue)
      }
      this.resourcesManager.storeResource({
        resource,
        isNew: true,
        path,
      })
    }
  }

  private mirrorServerMove(movedIri: string, originalSortValue: number, moveTo: number) {
    if (moveTo === originalSortValue) {
      return
    }
    for (const positionIri of this.persistedPositions()) {
      if (positionIri === movedIri) {
        continue
      }
      const sortValue = this.sortValueOf(positionIri)
      if (moveTo > originalSortValue && sortValue > originalSortValue && sortValue <= moveTo) {
        this.storeSortValue(positionIri, sortValue - 1)
      }
      else if (moveTo < originalSortValue && sortValue < originalSortValue && sortValue >= moveTo) {
        this.storeSortValue(positionIri, sortValue + 1)
      }
    }
  }

  private async sendMove(positionIri: string, moveTo: number): Promise<boolean> {
    const originalSortValue = this.sortValueOf(positionIri)
    const response = await this.resourcesManager.updateResource({
      endpoint: positionIri,
      data: {
        sortValue: moveTo,
      },
    })
    if (!response) {
      return false
    }
    this.storeSortValue(positionIri, moveTo)
    this.mirrorServerMove(positionIri, originalSortValue, moveTo)
    return true
  }

  private async repairDuplicateSortValues(positionIris: string[]): Promise<boolean> {
    const repairs: Array<[string, number]> = []
    let previousSortValue: number | undefined
    for (const positionIri of this.sortValueOrder(positionIris)) {
      const sortValue = this.sortValueOf(positionIri)
      const repairedSortValue = previousSortValue === undefined || sortValue > previousSortValue ? sortValue : previousSortValue + 1
      if (repairedSortValue !== sortValue) {
        repairs.push([positionIri, repairedSortValue])
      }
      previousSortValue = repairedSortValue
    }
    for (const [positionIri, repairedSortValue] of repairs.reverse()) {
      if (!await this.sendMove(positionIri, repairedSortValue)) {
        return false
      }
    }
    return true
  }

  private async sendMoves(desiredOrder: string[], moved: Set<string>): Promise<boolean> {
    let workingOrder = this.sortValueOrder(desiredOrder)
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
      if (!await this.sendMove(positionIri, this.sortValueOf(displacedIri))) {
        return false
      }
      withoutPosition.splice(targetIndex, 0, positionIri)
      workingOrder = withoutPosition
    }
    return true
  }

  private async syncGroupOrder() {
    const startGeneration = this.reorderGeneration
    const moved = this.movedIris
    this.movedIris = new Set()
    const desiredOrder = this.persistedPositions()
    this.applyPendingSortValues(this.collectPendingPositions(desiredOrder))
    const synced = await this.repairDuplicateSortValues(desiredOrder) && await this.sendMoves(desiredOrder, moved)
    if (!synced) {
      this.scheduleSync.cancel()
      this.movedIris = new Set()
      this.clearDisplayNumbers()
      return
    }
    if (startGeneration === this.reorderGeneration) {
      this.clearDisplayNumbers()
    }
  }
}

export class ComponentGroupReorders {
  private readonly groups = new Map<string, GroupReorder>()

  public constructor(
    private readonly admin: Admin,
    private readonly resources: Resources,
    private readonly resourcesManager: ResourcesManager,
  ) {}

  public acquire(iri: string) {
    let group = this.groups.get(iri)
    if (!group) {
      group = new GroupReorder(iri, this.admin, this.resources, this.resourcesManager)
      this.groups.set(iri, group)
    }
    if (group.mounts === 0) {
      this.admin.eventBus.on('reorder', group.handleReorderEvent)
    }
    group.mounts++
  }

  public release(iri: string) {
    const group = this.groups.get(iri)
    if (!group || group.mounts === 0) {
      return
    }
    group.mounts--
    if (group.mounts > 0) {
      return
    }
    this.admin.eventBus.off('reorder', group.handleReorderEvent)
    group.flush().then(() => {
      if (group.mounts === 0 && this.groups.get(iri) === group) {
        this.groups.delete(iri)
      }
    })
  }
}
