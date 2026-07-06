import type { NestedJsonStructure } from './state'

/**
 * Flatten a manifest depth node into the flat list of resource IRIs it contains: the node's own
 * `iri` followed by every descendant's `iri`, depth-first. Used to derive `irisByDepth[depth]`
 * (and the fetch-batch input) from the nested manifest tree, preserving the previous flat-list
 * semantics of `resource_iris[depth]`.
 */
export function flattenManifestNode(node: NestedJsonStructure): string[] {
  return [node.iri, ...node.children.flatMap(flattenManifestNode)]
}
