import type { NestedJsonStructure } from './state'

export function flattenManifestNode(node: NestedJsonStructure): string[] {
  return [node.iri, ...node.children.flatMap(flattenManifestNode)]
}
