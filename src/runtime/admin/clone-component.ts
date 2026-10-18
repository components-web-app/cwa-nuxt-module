import { ResourceTypeFromIri } from '../resources/resource-utils'
import { ErrorType } from '../storage/stores/error/state'
import { useCloneMode } from './clone-mode'
import type Cwa from '#cwa/cwa'

export type CloneAnchor = { after: string } | { before: string } | Record<string, never>

export type CloneTarget
  = { kind: 'position', groupIri: string, anchor: CloneAnchor }
    | { kind: 'page-data', positionIri: string, property: string }

export type CloneOutcome = 'added' | 'refused' | 'source-gone'

export const CLONE_SOURCE_GONE_MESSAGE = 'The component being cloned no longer exists'

function addPosition($cwa: Cwa, iri: string, groupIri: string, anchor: CloneAnchor) {
  const manager = $cwa.resourcesManager
  const endpoint = `${ResourceTypeFromIri.getPathPrefix() || ''}/_/component_positions`
  const request = manager.queueComponentGroupWrite(groupIri, async () => {
    const created = await manager.createResource({
      endpoint,
      data: { componentGroup: groupIri, component: iri, ...anchor },
      refreshEndpoints: [groupIri],
    })
    await manager.refreshComponentGroupOrder(groupIri)
    return created
  })
  return { endpoint, request }
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
  return { endpoint, request }
}

export async function cloneComponent($cwa: Cwa, { sourceIri, target }: { sourceIri: string, target: CloneTarget }): Promise<CloneOutcome> {
  const iri = $cwa.resources.findPublishedComponentIri(sourceIri).value ?? sourceIri
  const sent = target.kind === 'position'
    ? addPosition($cwa, iri, target.groupIri, target.anchor)
    : usePageDataSlot($cwa, iri, target.positionIri, target.property)
  if (!sent) {
    return 'refused'
  }

  const cloneMode = useCloneMode($cwa)
  if (await sent.request) {
    cloneMode.end()
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
    detail: CLONE_SOURCE_GONE_MESSAGE,
    violations: [],
    timestamp: Date.now(),
  })
  cloneMode.end()
  return 'source-gone'
}
