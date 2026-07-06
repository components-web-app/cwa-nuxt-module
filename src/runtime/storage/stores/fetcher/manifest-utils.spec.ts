import { describe, expect, test } from 'vitest'
import { flattenManifestNode } from './manifest-utils'
import type { NestedJsonStructure } from './state'

const node = (iri: string, children: NestedJsonStructure[] = []): NestedJsonStructure => ({ iri, children })

describe('flattenManifestNode', () => {
  test('a leaf flattens to just its own iri', () => {
    expect(flattenManifestNode(node('/_/routes//a'))).toEqual(['/_/routes//a'])
  })

  test('flattens depth-first: node iri first, then descendants', () => {
    const tree = node('/_/routes//conference', [
      node('/_/page_data/parent', [
        node('/_/pages/parent-template', [
          node('/_/component_groups/cg', [
            node('/_/component_positions/p1', [node('/component/hero/1')]),
          ]),
        ]),
      ]),
    ])
    expect(flattenManifestNode(tree)).toEqual([
      '/_/routes//conference',
      '/_/page_data/parent',
      '/_/pages/parent-template',
      '/_/component_groups/cg',
      '/_/component_positions/p1',
      '/component/hero/1',
    ])
  })

  test('collects every branch of a multi-child node', () => {
    const tree = node('/_/component_groups/cg', [
      node('/_/component_positions/p1', [node('/component/a/1')]),
      node('/_/component_positions/p2', [node('/component/b/1')]),
    ])
    expect(flattenManifestNode(tree)).toEqual([
      '/_/component_groups/cg',
      '/_/component_positions/p1',
      '/component/a/1',
      '/_/component_positions/p2',
      '/component/b/1',
    ])
  })
})
