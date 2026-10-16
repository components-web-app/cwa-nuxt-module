import { CwaResourceTypes } from '#cwa/resources/resource-utils'
import type { CwaResource } from '#cwa/resources/resource-utils'
import { compareSortValues } from '#cwa/resources/component-position-order'
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
  private syncing = false
  private changedWhileSyncing = false
  private syncQueue: Promise<void> = Promise.resolve()

  public constructor(
    private readonly iri: string,
    private readonly admin: Admin,
    private readonly resources: Resources,
    private readonly resourcesManager: ResourcesManager,
  ) {
    this.handleReorderEvent = this.handleReorderEvent.bind(this)
  }

  public flush(): Promise<void> {
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

    this.requestSync()
  }

  private requestSync() {
    if (this.syncing) {
      this.changedWhileSyncing = true
      return
    }
    this.syncing = true
    this.syncQueue = this.syncGroupOrder().finally(() => {
      this.syncing = false
    })
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

  private serverOrder(positionIris: string[]): string[] {
    return [...positionIris].sort((a, b) => compareSortValues(this.sortValueOf(a), a, this.sortValueOf(b), b))
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

  private async syncGroupOrder() {
    do {
      this.changedWhileSyncing = false
      await this.resourcesManager.queueComponentGroupWrite(this.iri, async () => {
        const desiredOrder = this.persistedPositions()
        this.applyPendingSortValues(this.collectPendingPositions(desiredOrder))
        if (desiredOrder.join() === this.serverOrder(desiredOrder).join()) {
          return
        }
        await this.resourcesManager.orderComponentGroup(this.iri, desiredOrder)
      })
    } while (this.changedWhileSyncing)
    this.clearDisplayNumbers()
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
