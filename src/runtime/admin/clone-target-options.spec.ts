import { afterEach, describe, expect, test } from 'vitest'
import { computed } from 'vue'
import { ResourceTypeFromIri } from '../resources/resource-utils'
import { cloneTargetOptions } from './clone-target-options'
import type { CloneTargetOptionsInput } from './clone-target-options'
import type { ApiDocumentationComponentMetadataCollection } from '#cwa/api/api-documentation'

const SOURCE = '/component/html_contents/source'
const PAGE = '/_/pages/page'
const LAYOUT = '/_/layouts/layout'
const GROUP = '/_/component_groups/group'
const EMPTY_GROUP = '/_/component_groups/empty'
const POSITION = '/_/component_positions/position'
const POSITION_2 = '/_/component_positions/position-2'
const COMPONENT = '/component/html_contents/target'
const DYNAMIC_POSITION = '/_/component_positions/dynamic'
const PAGE_DATA = '/page_data/article'
const CONTAINER_GROUP = '/_/component_groups/container-group'
const INNER_POSITION = '/_/component_positions/inner'
const INNER_COMPONENT = '/component/html_contents/inner'
const INNER_CONTAINER = '/component/containers/inner-container'
const INNER_CONTAINER_GROUP = '/_/component_groups/inner-container-group'

const metadata: ApiDocumentationComponentMetadataCollection = {
  HtmlContent: { resourceName: 'HtmlContent', endpoint: '/component/html_contents', isPublishable: true, explicitAllowOnly: false },
  Container: { resourceName: 'Container', endpoint: '/component/containers', isPublishable: false, explicitAllowOnly: false },
  Restricted: { resourceName: 'Restricted', endpoint: '/component/restricteds', isPublishable: false, explicitAllowOnly: true },
}

type Data = Record<string, any>

function buildResources(byId: Record<string, Data>, publishable: string[][] = []) {
  const childIris = (iri: string): string[] => {
    const data = byId[iri]
    if (!data) {
      return []
    }
    const direct = [
      ...(data.componentGroups ?? []),
      ...(data.componentPositions ?? []),
      ...(data.component ? [data.component] : []),
    ]
    return direct.flatMap(child => [child, ...childIris(child)])
  }
  return {
    getResource: (iri: string) => computed(() => byId[iri] ? { data: byId[iri] } : undefined),
    getChildIris: (iri: string) => childIris(iri),
    findAllPublishableIris: (iri: string) => publishable.find(set => set.includes(iri)) ?? [iri],
    pageDataIriOf: (iri: string) => computed(() => iri === DYNAMIC_POSITION ? PAGE_DATA : undefined),
    getOrderedPositionsForGroup: (iri: string) => byId[iri]?.componentPositions,
  } as unknown as CloneTargetOptionsInput['resources']
}

function stackOf(...iris: string[]) {
  return iris.map(iri => ({ iri }))
}

const pageStore: Record<string, Data> = {
  [PAGE]: { componentGroups: [GROUP, EMPTY_GROUP] },
  [GROUP]: { componentPositions: [POSITION, POSITION_2] },
  [POSITION]: { component: COMPONENT },
  [POSITION_2]: {},
  [COMPONENT]: { '@type': 'HtmlContent' },
  [EMPTY_GROUP]: { componentPositions: [] },
  [SOURCE]: { '@type': 'HtmlContent' },
}

function input(overrides: Partial<CloneTargetOptionsInput> = {}): CloneTargetOptionsInput {
  return {
    stack: stackOf(COMPONENT, POSITION, GROUP, PAGE),
    sourceIri: SOURCE,
    sourceType: 'HtmlContent',
    componentMetadata: metadata,
    resources: buildResources(pageStore),
    isDataPage: false,
    isEditingLayout: false,
    type: 'page',
    ...overrides,
  }
}

function summary(result: ReturnType<typeof cloneTargetOptions>) {
  return result.options.map(({ label, disabled, reasons }) => ({ label, disabled, reasons }))
}

const ENABLED = { disabled: false, reasons: [] }

describe('cloneTargetOptions', () => {
  afterEach(() => {
    ResourceTypeFromIri.setPathPrefix(undefined)
  })

  test('a component target offers Add before and Add after its position', () => {
    const result = cloneTargetOptions(input())
    expect(result.options).toEqual([
      { label: 'Add before', value: { kind: 'position', groupIri: GROUP, anchor: { before: POSITION } }, ...ENABLED },
      { label: 'Add after', value: { kind: 'position', groupIri: GROUP, anchor: { after: POSITION } }, ...ENABLED },
    ])
    expect(result.scope).toBeUndefined()
  })

  test('a group with positions offers Add to Start and Add to End', () => {
    const result = cloneTargetOptions(input({ stack: stackOf(GROUP, PAGE) }))
    expect(result.options).toEqual([
      { label: 'Add to Start', value: { kind: 'position', groupIri: GROUP, anchor: { before: POSITION } }, ...ENABLED },
      { label: 'Add to End', value: { kind: 'position', groupIri: GROUP, anchor: {} }, ...ENABLED },
    ])
  })

  test('an empty group offers Add here', () => {
    const result = cloneTargetOptions(input({ stack: stackOf(EMPTY_GROUP, PAGE) }))
    expect(result.options).toEqual([
      { label: 'Add here', value: { kind: 'position', groupIri: EMPTY_GROUP, anchor: {} }, ...ENABLED },
    ])
  })

  const dataPageStore: Record<string, Data> = {
    ...pageStore,
    [DYNAMIC_POSITION]: { pageDataProperty: 'hero' },
    [PAGE_DATA]: {
      _metadata: {
        pageDataMetadata: {
          properties: [
            { property: 'hero', componentShortName: 'HtmlContent' },
            { property: 'banner', componentShortName: 'Container' },
          ],
        },
      },
    },
  }

  test('a page-data slot offers Use here when the field holds the source\'s type', () => {
    const result = cloneTargetOptions(input({
      stack: stackOf(DYNAMIC_POSITION),
      resources: buildResources(dataPageStore),
      isDataPage: true,
    }))
    expect(result.options).toEqual([
      { label: 'Use here', value: { kind: 'page-data', positionIri: DYNAMIC_POSITION, property: 'hero' }, ...ENABLED },
    ])
  })

  test('Use here is disabled with a reason when the field holds another type', () => {
    const result = cloneTargetOptions(input({
      stack: stackOf(DYNAMIC_POSITION),
      resources: buildResources({ ...dataPageStore, [DYNAMIC_POSITION]: { pageDataProperty: 'banner' } }),
      isDataPage: true,
    }))
    expect(summary(result)).toEqual([
      { label: 'Use here', disabled: true, reasons: ['This field takes Container, not HtmlContent'] },
    ])
  })

  test('a page-data slot is only offered on a data page', () => {
    const result = cloneTargetOptions(input({
      stack: stackOf(DYNAMIC_POSITION),
      resources: buildResources(dataPageStore),
      isDataPage: false,
    }))
    expect(result.options).toEqual([])
  })

  test('offers nothing where add-component offers nothing on a data page', () => {
    const result = cloneTargetOptions(input({
      stack: stackOf(COMPONENT, POSITION),
      resources: buildResources(dataPageStore),
      isDataPage: true,
    }))
    expect(result.options).toEqual([])
  })

  test('a full target group disables every add option with the reason (#398)', () => {
    const resources = buildResources({ ...pageStore, [GROUP]: { ...pageStore[GROUP], maxComponents: 2 } })
    expect(summary(cloneTargetOptions(input({ resources })))).toEqual([
      { label: 'Add before', disabled: true, reasons: ['This group is full'] },
      { label: 'Add after', disabled: true, reasons: ['This group is full'] },
    ])
    expect(summary(cloneTargetOptions(input({ resources, stack: stackOf(GROUP, PAGE) })))).toEqual([
      { label: 'Add to Start', disabled: true, reasons: ['This group is full'] },
      { label: 'Add to End', disabled: true, reasons: ['This group is full'] },
    ])
  })

  test('a full source group does not disable a target in another group', () => {
    const SOURCE_GROUP = '/_/component_groups/source-group'
    const SOURCE_POSITION = '/_/component_positions/source-position'
    const resources = buildResources({
      ...pageStore,
      [SOURCE_GROUP]: { componentPositions: [SOURCE_POSITION], maxComponents: 1 },
      [SOURCE_POSITION]: { component: SOURCE },
    })
    expect(summary(cloneTargetOptions(input({ resources })))).toEqual([
      { label: 'Add before', ...ENABLED },
      { label: 'Add after', ...ENABLED },
    ])
  })

  test('a type the group does not list is disabled with the reason', () => {
    ResourceTypeFromIri.setPathPrefix('/_api')
    const listing = (allowedComponents: string[]) => buildResources({
      ...pageStore,
      [GROUP]: { ...pageStore[GROUP], allowedComponents },
    })
    expect(summary(cloneTargetOptions(input({ resources: listing(['/_api/component/containers']) })))).toEqual([
      { label: 'Add before', disabled: true, reasons: ['This group does not allow HtmlContent'] },
      { label: 'Add after', disabled: true, reasons: ['This group does not allow HtmlContent'] },
    ])
    expect(summary(cloneTargetOptions(input({ resources: listing(['/_api/component/html_contents']) })))).toEqual([
      { label: 'Add before', ...ENABLED },
      { label: 'Add after', ...ENABLED },
    ])
  })

  test('an explicitAllowOnly type is disabled in a group with no allowed list (#249)', () => {
    const result = cloneTargetOptions(input({ sourceType: 'Restricted' }))
    expect(summary(result)).toEqual([
      { label: 'Add before', disabled: true, reasons: ['This group does not allow Restricted'] },
      { label: 'Add after', disabled: true, reasons: ['This group does not allow Restricted'] },
    ])
  })

  test('finds the source\'s type from its IRI when the source is not loaded', () => {
    ResourceTypeFromIri.setPathPrefix('/_api')
    const result = cloneTargetOptions(input({ sourceIri: '/_api/component/restricteds/gone', sourceType: undefined }))
    expect(summary(result)).toEqual([
      { label: 'Add before', disabled: true, reasons: ['This group does not allow Restricted'] },
      { label: 'Add after', disabled: true, reasons: ['This group does not allow Restricted'] },
    ])
  })

  const CONTAINER = '/component/containers/source-container'
  const CONTAINER_DRAFT = '/component/containers/source-container-draft'
  const containerStore: Record<string, Data> = {
    ...pageStore,
    [POSITION]: { component: CONTAINER },
    [CONTAINER]: { '@type': 'Container', 'componentGroups': [CONTAINER_GROUP] },
    [CONTAINER_GROUP]: { componentPositions: [INNER_POSITION] },
    [INNER_POSITION]: { component: INNER_COMPONENT },
    [INNER_COMPONENT]: { '@type': 'HtmlContent' },
  }
  const insideContainer = stackOf(INNER_COMPONENT, INNER_POSITION, CONTAINER_GROUP, CONTAINER, POSITION, GROUP, PAGE)
  const INSIDE = 'This is inside the component being cloned'

  test('a target inside the source\'s own subtree is disabled with the reason', () => {
    const result = cloneTargetOptions(input({
      sourceIri: CONTAINER,
      sourceType: 'Container',
      stack: insideContainer,
      resources: buildResources(containerStore),
    }))
    expect(summary(result)).toEqual([
      { label: 'Add before', disabled: true, reasons: [INSIDE] },
      { label: 'Add after', disabled: true, reasons: [INSIDE] },
    ])
  })

  test('the subtree check treats the source\'s draft and published component as one', () => {
    const { [CONTAINER]: _published, ...withoutPublishedData } = containerStore
    const store = { ...withoutPublishedData, [CONTAINER_DRAFT]: { '@type': 'Container', 'componentGroups': [] } }
    const result = cloneTargetOptions(input({
      sourceIri: CONTAINER_DRAFT,
      sourceType: 'Container',
      stack: insideContainer,
      resources: buildResources(store, [[CONTAINER, CONTAINER_DRAFT]]),
    }))
    expect(summary(result)).toEqual([
      { label: 'Add before', disabled: true, reasons: [INSIDE] },
      { label: 'Add after', disabled: true, reasons: [INSIDE] },
    ])
  })

  test('a group of a container shown elsewhere is still refused as inside the source', () => {
    const OTHER_POSITION = '/_/component_positions/other'
    const store: Record<string, Data> = {
      ...containerStore,
      [GROUP]: { componentPositions: [POSITION, OTHER_POSITION] },
      [INNER_POSITION]: { component: INNER_CONTAINER },
      [OTHER_POSITION]: { component: INNER_CONTAINER },
      [INNER_CONTAINER]: { '@type': 'Container', 'componentGroups': [INNER_CONTAINER_GROUP] },
      [INNER_CONTAINER_GROUP]: { componentPositions: [] },
    }
    const result = cloneTargetOptions(input({
      sourceIri: CONTAINER,
      sourceType: 'Container',
      stack: stackOf(INNER_CONTAINER_GROUP, INNER_CONTAINER, OTHER_POSITION, GROUP, PAGE),
      resources: buildResources(store),
    }))
    expect(summary(result)).toEqual([
      { label: 'Add here', disabled: true, reasons: [INSIDE] },
    ])
  })

  test('cloning next to the source itself is allowed', () => {
    const store = { ...pageStore, [POSITION]: { component: SOURCE } }
    const result = cloneTargetOptions(input({
      stack: stackOf(SOURCE, POSITION, GROUP, PAGE),
      resources: buildResources(store),
    }))
    expect(summary(result)).toEqual([
      { label: 'Add before', ...ENABLED },
      { label: 'Add after', ...ENABLED },
    ])
  })

  test('lists every reason when several rules refuse an option', () => {
    const result = cloneTargetOptions(input({
      sourceIri: CONTAINER,
      sourceType: 'Container',
      stack: insideContainer,
      resources: buildResources({
        ...containerStore,
        [CONTAINER_GROUP]: { ...containerStore[CONTAINER_GROUP], maxComponents: 1, allowedComponents: ['/component/html_contents'] },
      }),
    }))
    const reasons = ['This group is full', 'This group does not allow Container', INSIDE]
    expect(summary(result)).toEqual([
      { label: 'Add before', disabled: true, reasons },
      { label: 'Add after', disabled: true, reasons },
    ])
  })

  test('names the layout scope when the target is in the layout while editing the page', () => {
    const layoutStore = { ...pageStore, [LAYOUT]: { componentGroups: [GROUP] } }
    const layoutStack = stackOf(COMPONENT, POSITION, GROUP, LAYOUT)
    expect(cloneTargetOptions(input({ stack: layoutStack, resources: buildResources(layoutStore), type: 'layout' })).scope).toBe('layout')
    expect(cloneTargetOptions(input({ isEditingLayout: true, type: 'page' })).scope).toBe('page')
    expect(cloneTargetOptions(input({ stack: layoutStack, resources: buildResources(layoutStore), type: 'layout', isEditingLayout: true })).scope).toBeUndefined()
  })

  test('a missing source type disables every option', () => {
    const result = cloneTargetOptions(input({ sourceIri: '/component/unknowns/x', sourceType: undefined }))
    expect(summary(result)).toEqual([
      { label: 'Add before', disabled: true, reasons: ['This component type is not known'] },
      { label: 'Add after', disabled: true, reasons: ['This component type is not known'] },
    ])
  })
})
