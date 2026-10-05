import { CwaResourceTypes, getResourceTypeFromIri, ResourceTypeFromIri } from '../../../resources/resource-utils'
import type { NestedJsonStructure } from './state'

export function flattenManifestNode(node: NestedJsonStructure): string[] {
  return [node.iri, ...node.children.flatMap(flattenManifestNode)]
}

export function manifestDepthPath(irisAtDepth: string[]): string | undefined {
  const routePathPrefix = `${ResourceTypeFromIri.getPathPrefix() || ''}/_/routes/`
  const routeIri = irisAtDepth.find(iri => iri.startsWith(routePathPrefix))
  if (routeIri !== undefined) {
    return routeIri.substring(routePathPrefix.length)
  }
  return irisAtDepth.find(iri => getResourceTypeFromIri(iri) === CwaResourceTypes.PAGE_DATA)
}

export function findManifestNode(node: NestedJsonStructure, iri: string): NestedJsonStructure | undefined {
  if (node.iri === iri) {
    return node
  }
  for (const child of node.children) {
    const found = findManifestNode(child, iri)
    if (found) {
      return found
    }
  }
  return undefined
}
