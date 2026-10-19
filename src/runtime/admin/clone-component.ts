import { ResourceTypeFromIri } from '../resources/resource-utils'
import { ErrorType } from '../storage/stores/error/state'
import { nextTick } from 'vue'
import { useCloneMode } from './clone-mode'
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
  return { endpoint, request, placedIri: (created: any) => created?.['@id'] }
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
  return { endpoint, request, placedIri: () => positionIri }
}

function movePosition($cwa: Cwa, positionIri: string, groupIri: string, anchor: CloneAnchor) {
  const manager = $cwa.resourcesManager
  const sourceGroupIri: string | undefined = $cwa.resources.getResource(positionIri).value?.data?.componentGroup
  const groups = [...new Set([groupIri, sourceGroupIri].filter((iri): iri is string => !!iri))]
  const request = manager.queueComponentGroupWrite(groupIri, async () => {
    const moved = await manager.updateResource({
      endpoint: positionIri,
      data: { componentGroup: groupIri, ...anchor },
      refreshEndpoints: groups,
    })
    for (const iri of groups) {
      await manager.refreshComponentGroupOrder(iri)
    }
    return moved
  })
  return { endpoint: positionIri, request, placedIri: () => positionIri }
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
  if (error?.statusCode !== 404) {
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

export function moveComponent($cwa: Cwa, { positionIri, target }: { positionIri: string, target: CloneTarget }): Promise<CloneOutcome> {
  const sent = target.kind === 'position' ? movePosition($cwa, positionIri, target.groupIri, target.anchor) : undefined
  return finish($cwa, sent, MOVE_SOURCE_GONE_MESSAGE)
}
