import type { NestedJsonStructure } from '../storage/stores/fetcher/state'
import { flattenManifestNode, manifestDepthPath } from '../storage/stores/fetcher/manifest-utils'
import { CwaResourceTypes, getResourceTypeFromIri } from '../resources/resource-utils'

export interface PageCachePurgeBody {
  paths?: string[]
  tags?: string[]
}

export function pageCachePurgeBody(resourceTree: NestedJsonStructure[] | undefined): PageCachePurgeBody | undefined {
  const iris = [...new Set((resourceTree ?? []).flatMap(flattenManifestNode))]
  const paths = (resourceTree ?? [])
    .map(depthTree => manifestDepthPath([depthTree.iri]))
    .filter((path): path is string => !!path && getResourceTypeFromIri(path) !== CwaResourceTypes.PAGE_DATA)
  const manifestTags = iris
    .filter((iri) => {
      const type = getResourceTypeFromIri(iri)
      return type === CwaResourceTypes.PAGE || type === CwaResourceTypes.PAGE_DATA
    })
    .map(iri => `manifest:${iri}`)
  const tags = [...iris, ...manifestTags]
  if (!tags.length) {
    return undefined
  }
  return paths.length ? { paths, tags } : { tags }
}
