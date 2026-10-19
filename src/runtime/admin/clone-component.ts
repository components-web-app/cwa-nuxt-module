import { ResourceTypeFromIri } from '../resources/resource-utils'
import { ErrorType } from '../storage/stores/error/state'
import type { CwaErrorEvent } from '../storage/stores/error/state'
import { nextTick } from 'vue'
import { useCloneMode } from './clone-mode'
import type { CloneMove } from './clone-mode'
import { instancesOf, onInstancesChange } from './manageable-instances'
import type Cwa from '#cwa/cwa'

export type CloneAnchor = { after: string } | { before: string } | Record<string, never>

export type CloneTarget
  = { kind: 'position', groupIri: string, anchor: CloneAnchor }
    | { kind: 'page-data', positionIri: string, property: string }

export type CloneOutcome = 'added' | 'refused' | 'source-gone'

export const CLONE_SOURCE_GONE_MESSAGE = 'The component being cloned no longer exists'
export const MOVE_SOURCE_GONE_MESSAGE = 'The component being moved no longer exists'

const PLACED_SELECT_TIMEOUT_MS = 2000

interface SentWrite {
  endpoint: string
  request: Promise<unknown>
  placedIri: (result: any) => string | undefined
  isSourceGone: (error: CwaErrorEvent) => boolean
}

function cloneSourceGone(componentIri: string) {
  return (error: CwaErrorEvent) => error.statusCode === 404 || (error.statusCode === 400 && !!error.detail?.startsWith(`Item not found for "${componentIri}"`))
}

function moveSourceGone(error: CwaErrorEvent) {
  return error.statusCode === 404 || (error.statusCode === 422 && !!error.violations?.some(({ property }) => property === 'from' || property?.startsWith('from.')))
}

function unique(iris: (string | undefined)[]) {
  return [...new Set(iris.filter((iri): iri is string => !!iri))]
}

function addPosition($cwa: Cwa, iri: string, groupIri: string, anchor: CloneAnchor) {
  const manager = $cwa.resourcesManager
  const endpoint = `${ResourceTypeFromIri.getPathPrefix() || ''}/_/component_positions`
  const request = manager.queueComponentGroupWrite(groupIri, async () => {
    const created = await manager.createResource({
      endpoint,
      data: { componentGroup: groupIri, component: iri, ...anchor },
      refreshEndpoints: [groupIri],
    })
    if (!created) {
      await manager.refreshEndpoints([groupIri])
    }
    await manager.refreshComponentGroupOrder(groupIri)
    return created
  })
  return { endpoint, request, placedIri: (created: any) => created?.['@id'], isSourceGone: cloneSourceGone(iri) }
}

function usePageDataSlot($cwa: Cwa, iri: string, positionIri: string, property: string) {
  const endpoint = $cwa.resources.pageDataIriOf(positionIri).value
  if (!endpoint) {
    return
  }
  const request = $cwa.resourcesManager.updateResource({
    endpoint,
    data: { [property]: iri },
    refreshEndpoints: [positionIri],
  })
  return { endpoint, request, placedIri: () => positionIri, isSourceGone: cloneSourceGone(iri) }
}

function sendMove($cwa: Cwa, sourceIri: string, { positionIri, from }: CloneMove, target: CloneTarget): SentWrite | undefined {
  const { resources, resourcesManager: manager } = $cwa
  const iri = resources.findPublishedComponentIri(sourceIri).value ?? sourceIri
  const toPageData = target.kind === 'page-data' ? resources.pageDataIriOf(target.positionIri).value : undefined
  if (target.kind === 'page-data' && !toPageData) {
    return
  }
  const to = target.kind === 'position'
    ? { componentGroup: target.groupIri, ...target.anchor }
    : { pageData: toPageData!, property: target.property }
  const fromPosition = 'componentPosition' in from ? from.componentPosition : undefined
  const fromGroup: string | undefined = fromPosition && resources.getResource(fromPosition).value?.data?.componentGroup
  const toGroup = target.kind === 'position' ? target.groupIri : undefined
  const groups = unique([toGroup, fromGroup])
  const onScreen = (iris: string[]) => iris.filter(iri => resources.currentIds.includes(iri))
  const refresh = unique([
    ...(target.kind === 'page-data' ? [toPageData, target.positionIri] : []),
    ...onScreen('pageData' in from ? [from.pageData, positionIri] : (toGroup ? [from.componentPosition] : [])),
    ...groups,
  ])

  const write = async () => {
    const moved = await manager.moveComponent(iri, { from, to })
    if (moved) {
      if (fromPosition && !toGroup) {
        manager.removeResource({ resource: fromPosition })
      }
      await manager.refreshEndpoints(refresh)
    }
    for (const groupIri of groups) {
      await manager.refreshComponentGroupOrder(groupIri)
    }
    return moved
  }
  const queueIri = toGroup ?? fromGroup
  return {
    endpoint: `${iri}/move`,
    request: queueIri ? manager.queueComponentGroupWrite(queueIri, write) : write(),
    placedIri: moved => moved?.componentPosition ?? (target.kind === 'page-data' ? target.positionIri : undefined),
    isSourceGone: moveSourceGone,
  }
}

function selectWhenShown($cwa: Cwa, positionIri: string) {
  const isShown = () => instancesOf($cwa, positionIri).length > 0
  const select = () => $cwa.admin.eventBus.emit('selectResource', positionIri)
  void nextTick(() => {
    if (isShown()) {
      select()
      return
    }
    const stop = onInstancesChange($cwa, () => {
      if (isShown()) {
        stopWaiting()
        select()
      }
    })
    const timer = setTimeout(stop, PLACED_SELECT_TIMEOUT_MS)
    function stopWaiting() {
      clearTimeout(timer)
      stop()
    }
  })
}

async function finish($cwa: Cwa, sent: SentWrite | undefined, sourceGoneMessage: string): Promise<CloneOutcome> {
  if (!sent) {
    return 'refused'
  }

  const cloneMode = useCloneMode($cwa)
  const result = await sent.request
  if (result) {
    cloneMode.end()
    const placedIri = sent.placedIri(result)
    if (placedIri) {
      cloneMode.showPlaced(placedIri)
      selectWhenShown($cwa, placedIri)
    }
    return 'added'
  }

  const error = $cwa.resourcesManager.errors.filter(error => error.event?.endpoint === sent.endpoint).at(-1)
  if (!error || !sent.isSourceGone(error)) {
    return 'refused'
  }

  $cwa.resourcesManager.removeError(error.timestamp)
  $cwa.resourcesManager.addError({
    type: ErrorType.SERVER,
    statusCode: 404,
    detail: sourceGoneMessage,
    violations: [],
    timestamp: Date.now(),
  })
  cloneMode.end()
  return 'source-gone'
}

export function cloneComponent($cwa: Cwa, { sourceIri, target }: { sourceIri: string, target: CloneTarget }): Promise<CloneOutcome> {
  const iri = $cwa.resources.findPublishedComponentIri(sourceIri).value ?? sourceIri
  const sent = target.kind === 'position'
    ? addPosition($cwa, iri, target.groupIri, target.anchor)
    : usePageDataSlot($cwa, iri, target.positionIri, target.property)
  return finish($cwa, sent, CLONE_SOURCE_GONE_MESSAGE)
}

export function moveComponent($cwa: Cwa, { sourceIri, move, target }: { sourceIri: string, move: CloneMove, target: CloneTarget }): Promise<CloneOutcome> {
  return finish($cwa, sendMove($cwa, sourceIri, move, target), MOVE_SOURCE_GONE_MESSAGE)
}
