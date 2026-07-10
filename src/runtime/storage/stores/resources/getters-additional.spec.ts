// @vitest-environment happy-dom
import { describe, expect, test, beforeEach } from 'vitest'
import { reactive } from 'vue'
import type { CwaResourcesGettersInterface } from './getters'
import getters from './getters'
import type { CwaResourcesStateInterface } from './state'
import { CwaResourceApiStatuses, NEW_RESOURCE_IRI } from './state'

function createState(): CwaResourcesStateInterface {
  return {
    current: reactive({
      byId: {},
      allIds: [],
      currentIds: [],
      publishableMapping: [],
    }),
    new: reactive({
      byId: {},
      allIds: [],
    }),
  }
}

describe('getters -> hasNewResources', () => {
  let state: CwaResourcesStateInterface
  let getterFns: CwaResourcesGettersInterface

  beforeEach(() => {
    state = createState()
    getterFns = getters(state)
  })

  test('returns false when no new resources', () => {
    expect(getterFns.hasNewResources.value).toBe(false)
  })

  test('returns true when new resources exist', () => {
    state.new.allIds = ['/new/resource']
    expect(getterFns.hasNewResources.value).toBe(true)
  })
})

describe('getters -> getResource', () => {
  let state: CwaResourcesStateInterface
  let getterFns: CwaResourcesGettersInterface

  beforeEach(() => {
    state = createState()
    getterFns = getters(state)
  })

  test('returns the resource for a given IRI', () => {
    const resource = { apiState: { status: CwaResourceApiStatuses.SUCCESS }, data: { '@id': '/my/resource', '@type': 'Component' } }
    state.current.byId['/my/resource'] = resource
    expect(getterFns.getResource.value('/my/resource')).toStrictEqual(resource)
  })

  test('returns undefined for an unknown IRI', () => {
    expect(getterFns.getResource.value('/does-not-exist')).toBeUndefined()
  })
})

describe('getters -> publishedToDraftIris / draftToPublishedIris', () => {
  let state: CwaResourcesStateInterface
  let getterFns: CwaResourcesGettersInterface

  beforeEach(() => {
    state = createState()
    getterFns = getters(state)
  })

  test('publishedToDraftIris is empty when no mapping', () => {
    expect(getterFns.publishedToDraftIris.value).toEqual({})
  })

  test('draftToPublishedIris is empty when no mapping', () => {
    expect(getterFns.draftToPublishedIris.value).toEqual({})
  })

  test('publishedToDraftIris maps published IRI to draft IRI', () => {
    state.current.publishableMapping = [
      { publishedIri: '/component/published', draftIri: '/component/draft' },
    ]
    expect(getterFns.publishedToDraftIris.value).toEqual({
      '/component/published': '/component/draft',
    })
  })

  test('draftToPublishedIris maps draft IRI to published IRI', () => {
    state.current.publishableMapping = [
      { publishedIri: '/component/published', draftIri: '/component/draft' },
    ]
    expect(getterFns.draftToPublishedIris.value).toEqual({
      '/component/draft': '/component/published',
    })
  })

  test('handles multiple mappings', () => {
    state.current.publishableMapping = [
      { publishedIri: '/a/published', draftIri: '/a/draft' },
      { publishedIri: '/b/published', draftIri: '/b/draft' },
    ]
    expect(getterFns.draftToPublishedIris.value['/a/draft']).toBe('/a/published')
    expect(getterFns.draftToPublishedIris.value['/b/draft']).toBe('/b/published')
  })
})

describe('getters -> isIriPublishableEquivalent', () => {
  let state: CwaResourcesStateInterface
  let getterFns: CwaResourcesGettersInterface

  beforeEach(() => {
    state = createState()
    state.current.publishableMapping = [
      { publishedIri: '/component/published', draftIri: '/component/draft' },
    ]
    getterFns = getters(state)
  })

  test('returns true when newIri is the draft counterpart of oldIri (published)', () => {
    expect(getterFns.isIriPublishableEquivalent.value('/component/published', '/component/draft')).toBe(true)
  })

  test('returns true when newIri is the published counterpart of oldIri (draft)', () => {
    expect(getterFns.isIriPublishableEquivalent.value('/component/draft', '/component/published')).toBe(true)
  })

  test('returns false when newIri is unrelated', () => {
    expect(getterFns.isIriPublishableEquivalent.value('/component/published', '/other/resource')).toBe(false)
  })
})

describe('getters -> findAllPublishableIris', () => {
  let state: CwaResourcesStateInterface
  let getterFns: CwaResourcesGettersInterface

  beforeEach(() => {
    state = createState()
    getterFns = getters(state)
  })

  test('returns only the iri when not in any mapping', () => {
    expect(getterFns.findAllPublishableIris.value('/some/resource')).toEqual(['/some/resource'])
  })

  test('returns iri and its draft when iri is published', () => {
    state.current.publishableMapping = [
      { publishedIri: '/component/published', draftIri: '/component/draft' },
    ]
    expect(getterFns.findAllPublishableIris.value('/component/published')).toEqual([
      '/component/published',
      '/component/draft',
    ])
  })

  test('returns iri and its published counterpart when iri is draft', () => {
    state.current.publishableMapping = [
      { publishedIri: '/component/published', draftIri: '/component/draft' },
    ]
    expect(getterFns.findAllPublishableIris.value('/component/draft')).toEqual([
      '/component/draft',
      '/component/published',
    ])
  })
})

describe('getters -> findPublishedComponentIri / findDraftComponentIri', () => {
  let state: CwaResourcesStateInterface
  let getterFns: CwaResourcesGettersInterface

  beforeEach(() => {
    state = createState()
    state.current.publishableMapping = [
      { publishedIri: '/component/published', draftIri: '/component/draft' },
    ]
    getterFns = getters(state)
  })

  test('findPublishedComponentIri returns iri when resource is not publishable (no _metadata.publishable)', () => {
    state.current.byId['/component/any'] = {
      apiState: { status: CwaResourceApiStatuses.SUCCESS },
      data: { '@id': '/component/any', '@type': 'Component', '_metadata': {} },
    }
    expect(getterFns.findPublishedComponentIri.value('/component/any')).toBe('/component/any')
  })

  test('findPublishedComponentIri returns iri when resource is published', () => {
    state.current.byId['/component/published'] = {
      apiState: { status: CwaResourceApiStatuses.SUCCESS },
      data: { '@id': '/component/published', '@type': 'Component', '_metadata': { publishable: { published: true } } },
    }
    expect(getterFns.findPublishedComponentIri.value('/component/published')).toBe('/component/published')
  })

  test('findPublishedComponentIri returns mapped published IRI when resource is draft', () => {
    state.current.byId['/component/draft'] = {
      apiState: { status: CwaResourceApiStatuses.SUCCESS },
      data: { '@id': '/component/draft', '@type': 'Component', '_metadata': { publishable: { published: false } } },
    }
    expect(getterFns.findPublishedComponentIri.value('/component/draft')).toBe('/component/published')
  })

  test('findPublishedComponentIri returns undefined when resource does not exist', () => {
    expect(getterFns.findPublishedComponentIri.value('/non-existent')).toBeUndefined()
  })

  test('findPublishedComponentIri returns undefined for a draft that has never been published (callers rely on this)', () => {
    state.current.byId['/component/unpublished-draft'] = {
      apiState: { status: CwaResourceApiStatuses.SUCCESS },
      data: { '@id': '/component/unpublished-draft', '@type': 'Component', '_metadata': { publishable: { published: false } } },
    }
    expect(getterFns.findPublishedComponentIri.value('/component/unpublished-draft')).toBeUndefined()
  })

  test('findDraftComponentIri returns iri when resource is draft', () => {
    state.current.byId['/component/draft'] = {
      apiState: { status: CwaResourceApiStatuses.SUCCESS },
      data: { '@id': '/component/draft', '@type': 'Component', '_metadata': { publishable: { published: false } } },
    }
    expect(getterFns.findDraftComponentIri.value('/component/draft')).toBe('/component/draft')
  })

  test('findDraftComponentIri returns mapped draft IRI when resource is published', () => {
    state.current.byId['/component/published'] = {
      apiState: { status: CwaResourceApiStatuses.SUCCESS },
      data: { '@id': '/component/published', '@type': 'Component', '_metadata': { publishable: { published: true } } },
    }
    expect(getterFns.findDraftComponentIri.value('/component/published')).toBe('/component/draft')
  })

  test('findDraftComponentIri treats non-existent resource as draft and returns its IRI', () => {
    // findIsPublishedByIri returns false (not undefined) for missing resources,
    // so the IRI itself is returned as the "draft" IRI
    expect(getterFns.findDraftComponentIri.value('/non-existent')).toBe('/non-existent')
  })
})

describe('getters -> getOrderedPositionsForGroup', () => {
  let state: CwaResourcesStateInterface
  let getterFns: CwaResourcesGettersInterface

  beforeEach(() => {
    state = createState()
    getterFns = getters(state)
  })

  test('returns undefined when group does not exist', () => {
    expect(getterFns.getOrderedPositionsForGroup.value('/non-existent')).toBeUndefined()
  })

  test('returns undefined when group has no componentPositions', () => {
    state.current.byId['/_/component_groups/1'] = {
      apiState: { status: CwaResourceApiStatuses.SUCCESS },
      data: { '@id': '/_/component_groups/1', '@type': 'ComponentGroup' },
    }
    expect(getterFns.getOrderedPositionsForGroup.value('/_/component_groups/1')).toBeUndefined()
  })

  test('returns positions sorted by sortValue', () => {
    state.current.byId['/_/component_groups/1'] = {
      apiState: { status: CwaResourceApiStatuses.SUCCESS },
      data: {
        '@id': '/_/component_groups/1',
        'componentPositions': ['/_/component_positions/b', '/_/component_positions/a'],
      },
    }
    state.current.byId['/_/component_positions/a'] = {
      apiState: { status: CwaResourceApiStatuses.SUCCESS },
      data: { '@id': '/_/component_positions/a', 'sortValue': 1, '_metadata': {} },
    }
    state.current.byId['/_/component_positions/b'] = {
      apiState: { status: CwaResourceApiStatuses.SUCCESS },
      data: { '@id': '/_/component_positions/b', 'sortValue': 2, '_metadata': {} },
    }
    const result = getterFns.getOrderedPositionsForGroup.value('/_/component_groups/1')
    expect(result).toEqual(['/_/component_positions/a', '/_/component_positions/b'])
  })

  test('positions sorted by _metadata.sortDisplayNumber take precedence over sortValue', () => {
    state.current.byId['/_/component_groups/1'] = {
      apiState: { status: CwaResourceApiStatuses.SUCCESS },
      data: {
        '@id': '/_/component_groups/1',
        'componentPositions': ['/_/component_positions/x', '/_/component_positions/y'],
      },
    }
    state.current.byId['/_/component_positions/x'] = {
      apiState: { status: CwaResourceApiStatuses.SUCCESS },
      data: { '@id': '/_/component_positions/x', 'sortValue': 1, '_metadata': { sortDisplayNumber: 2 } },
    }
    state.current.byId['/_/component_positions/y'] = {
      apiState: { status: CwaResourceApiStatuses.SUCCESS },
      data: { '@id': '/_/component_positions/y', 'sortValue': 2, '_metadata': { sortDisplayNumber: 1 } },
    }
    const result = getterFns.getOrderedPositionsForGroup.value('/_/component_groups/1')
    expect(result).toEqual(['/_/component_positions/y', '/_/component_positions/x'])
  })

  test('filters out new IRI positions when includeNewIri=false', () => {
    const newIri = `/_/component_positions/${NEW_RESOURCE_IRI}`
    state.current.byId['/_/component_groups/1'] = {
      apiState: { status: CwaResourceApiStatuses.SUCCESS },
      data: {
        '@id': '/_/component_groups/1',
        'componentPositions': ['/_/component_positions/a', newIri],
      },
    }
    state.current.byId['/_/component_positions/a'] = {
      apiState: { status: CwaResourceApiStatuses.SUCCESS },
      data: { '@id': '/_/component_positions/a', 'sortValue': 1, '_metadata': {} },
    }
    const result = getterFns.getOrderedPositionsForGroup.value('/_/component_groups/1', false)
    expect(result).toEqual(['/_/component_positions/a'])
    expect(result).not.toContain(newIri)
  })

  test('skips positions that do not exist in byId', () => {
    state.current.byId['/_/component_groups/1'] = {
      apiState: { status: CwaResourceApiStatuses.SUCCESS },
      data: {
        '@id': '/_/component_groups/1',
        'componentPositions': ['/_/component_positions/ghost', '/_/component_positions/a'],
      },
    }
    state.current.byId['/_/component_positions/a'] = {
      apiState: { status: CwaResourceApiStatuses.SUCCESS },
      data: { '@id': '/_/component_positions/a', 'sortValue': 1, '_metadata': {} },
    }
    const result = getterFns.getOrderedPositionsForGroup.value('/_/component_groups/1')
    expect(result).toEqual(['/_/component_positions/a'])
  })
})

describe('getters -> getPositionSortDisplayNumber', () => {
  let state: CwaResourcesStateInterface
  let getterFns: CwaResourcesGettersInterface

  beforeEach(() => {
    state = createState()
    getterFns = getters(state)
  })

  test('returns undefined when position does not exist', () => {
    expect(getterFns.getPositionSortDisplayNumber.value('/non-existent')).toBeUndefined()
  })

  test('returns undefined when position has no componentGroup', () => {
    state.current.byId['/_/component_positions/1'] = {
      apiState: { status: CwaResourceApiStatuses.SUCCESS },
      data: { '@id': '/_/component_positions/1', '_metadata': {} },
    }
    expect(getterFns.getPositionSortDisplayNumber.value('/_/component_positions/1')).toBeUndefined()
  })

  test('returns undefined when position is not found in the group', () => {
    state.current.byId['/_/component_groups/1'] = {
      apiState: { status: CwaResourceApiStatuses.SUCCESS },
      data: { '@id': '/_/component_groups/1', 'componentPositions': [] },
    }
    state.current.byId['/_/component_positions/1'] = {
      apiState: { status: CwaResourceApiStatuses.SUCCESS },
      data: { '@id': '/_/component_positions/1', 'componentGroup': '/_/component_groups/1', '_metadata': {} },
    }
    expect(getterFns.getPositionSortDisplayNumber.value('/_/component_positions/1')).toBeUndefined()
  })

  test('returns 1-based index of position in ordered group', () => {
    state.current.byId['/_/component_groups/1'] = {
      apiState: { status: CwaResourceApiStatuses.SUCCESS },
      data: {
        '@id': '/_/component_groups/1',
        'componentPositions': ['/_/component_positions/a', '/_/component_positions/b'],
      },
    }
    state.current.byId['/_/component_positions/a'] = {
      apiState: { status: CwaResourceApiStatuses.SUCCESS },
      data: { '@id': '/_/component_positions/a', 'componentGroup': '/_/component_groups/1', 'sortValue': 1, '_metadata': {} },
    }
    state.current.byId['/_/component_positions/b'] = {
      apiState: { status: CwaResourceApiStatuses.SUCCESS },
      data: { '@id': '/_/component_positions/b', 'componentGroup': '/_/component_groups/1', 'sortValue': 2, '_metadata': {} },
    }
    expect(getterFns.getPositionSortDisplayNumber.value('/_/component_positions/a')).toBe(1)
    expect(getterFns.getPositionSortDisplayNumber.value('/_/component_positions/b')).toBe(2)
  })
})

describe('getters -> getChildIris', () => {
  let state: CwaResourcesStateInterface
  let getterFns: CwaResourcesGettersInterface

  beforeEach(() => {
    state = createState()
    getterFns = getters(state)
  })

  test('returns empty array for NEW_RESOURCE_IRI', () => {
    expect(getterFns.getChildIris.value(NEW_RESOURCE_IRI, undefined)).toEqual([])
  })

  test('returns empty array when resource does not exist', () => {
    expect(getterFns.getChildIris.value('/does-not-exist', undefined)).toEqual([])
  })

  test('returns empty array when resource has no type derivable from IRI', () => {
    state.current.byId['/unknown-type-resource'] = {
      apiState: { status: CwaResourceApiStatuses.SUCCESS },
      data: { '@id': '/unknown-type-resource' },
    }
    expect(getterFns.getChildIris.value('/unknown-type-resource', undefined)).toEqual([])
  })

  test('adds placeholder for COMPONENT_POSITION', () => {
    state.current.byId['/_/component_positions/1'] = {
      apiState: { status: CwaResourceApiStatuses.SUCCESS },
      data: { '@id': '/_/component_positions/1' },
    }
    const result = getterFns.getChildIris.value('/_/component_positions/1', undefined)
    expect(result).toContain('/_/component_positions/1_placeholder')
  })

  test('adds placeholder for COMPONENT_GROUP', () => {
    state.current.byId['/_/component_groups/1'] = {
      apiState: { status: CwaResourceApiStatuses.SUCCESS },
      data: { '@id': '/_/component_groups/1' },
    }
    const result = getterFns.getChildIris.value('/_/component_groups/1', undefined)
    expect(result).toContain('/_/component_groups/1_placeholder')
  })

  test('recurses into componentPositions for COMPONENT_GROUP', () => {
    state.current.byId['/_/component_groups/1'] = {
      apiState: { status: CwaResourceApiStatuses.SUCCESS },
      data: {
        '@id': '/_/component_groups/1',
        'componentPositions': ['/_/component_positions/1'],
      },
    }
    state.current.byId['/_/component_positions/1'] = {
      apiState: { status: CwaResourceApiStatuses.SUCCESS },
      data: { '@id': '/_/component_positions/1' },
    }
    const result = getterFns.getChildIris.value('/_/component_groups/1', undefined)
    expect(result).toContain('/_/component_positions/1')
    expect(result).toContain('/_/component_positions/1_placeholder')
  })

  test('recurses into component for COMPONENT_POSITION', () => {
    state.current.byId['/_/component_positions/1'] = {
      apiState: { status: CwaResourceApiStatuses.SUCCESS },
      data: {
        '@id': '/_/component_positions/1',
        'component': '/component/abc',
      },
    }
    state.current.byId['/component/abc'] = {
      apiState: { status: CwaResourceApiStatuses.SUCCESS },
      data: { '@id': '/component/abc' },
    }
    const result = getterFns.getChildIris.value('/_/component_positions/1', undefined)
    expect(result).toContain('/component/abc')
  })

  test('pushes NEW_RESOURCE_IRI when addResourceEvent targets the COMPONENT_POSITION', () => {
    state.current.byId['/_/component_positions/1'] = {
      apiState: { status: CwaResourceApiStatuses.SUCCESS },
      data: { '@id': '/_/component_positions/1' },
    }
    const addResourceEvent = {
      closest: { position: '/_/component_positions/1', group: '/_/component_groups/1' },
      targetIri: '/_/component_positions/1',
      addAfter: null,
    }
    const result = getterFns.getChildIris.value('/_/component_positions/1', addResourceEvent)
    expect(result).toContain(NEW_RESOURCE_IRI)
  })

  test('does NOT push NEW_RESOURCE_IRI for COMPONENT_POSITION when addAfter is not null', () => {
    state.current.byId['/_/component_positions/1'] = {
      apiState: { status: CwaResourceApiStatuses.SUCCESS },
      data: { '@id': '/_/component_positions/1' },
    }
    const addResourceEvent = {
      closest: { position: '/_/component_positions/1', group: '/_/component_groups/1' },
      targetIri: '/_/component_positions/1',
      addAfter: '/_/component_positions/1',
    }
    const result = getterFns.getChildIris.value('/_/component_positions/1', addResourceEvent)
    expect(result).not.toContain(NEW_RESOURCE_IRI)
  })
})
