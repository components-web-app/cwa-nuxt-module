import { afterEach, describe, expect, test } from 'vitest'
import { computed } from 'vue'
import { ResourceTypeFromIri } from '../resources/resource-utils'
import { cloneAnchorIndex, cloneTargetOptions, sharedReasons } from './clone-target-options'
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
      stack: stackOf(COMPONENT, DYNAMIC_POSITION, PAGE),
      resources: buildResources(dataPageStore),
      isDataPage: true,
    }))
    expect(result.options).toEqual([
      { label: 'Use here', value: { kind: 'page-data', positionIri: DYNAMIC_POSITION, property: 'hero' }, ...ENABLED },
    ])
  })

  test('Use here is disabled with a reason when the field holds another type', () => {
    const result = cloneTargetOptions(input({
      stack: stackOf(DYNAMIC_POSITION, PAGE),
      resources: buildResources({ ...dataPageStore, [DYNAMIC_POSITION]: { pageDataProperty: 'banner' } }),
      isDataPage: true,
    }))
    expect(summary(result)).toEqual([
      { label: 'Use here', disabled: true, reasons: ['This field takes Container, not HtmlContent'] },
    ])
  })

  test('a page-data slot whose group is still in the stack offers Use here beside the group\'s options', () => {
    const result = cloneTargetOptions(input({
      stack: stackOf(COMPONENT, DYNAMIC_POSITION, GROUP, PAGE),
      resources: buildResources(dataPageStore),
      isDataPage: true,
    }))
    expect(result.options).toEqual([
      { label: 'Add before', value: { kind: 'position', groupIri: GROUP, anchor: { before: DYNAMIC_POSITION } }, ...ENABLED },
      { label: 'Add after', value: { kind: 'position', groupIri: GROUP, anchor: { after: DYNAMIC_POSITION } }, ...ENABLED },
      { label: 'Use here', value: { kind: 'page-data', positionIri: DYNAMIC_POSITION, property: 'hero' }, ...ENABLED },
    ])
  })

  test('a page-data slot outside the clicked group is not offered', () => {
    const result = cloneTargetOptions(input({
      stack: stackOf(CONTAINER_GROUP, INNER_CONTAINER, DYNAMIC_POSITION, PAGE),
      resources: buildResources(dataPageStore),
      isDataPage: true,
    }))
    expect(result.options.map(item => item.label)).toEqual(['Add here'])
  })

  test('a page-data slot is only offered on a data page', () => {
    const result = cloneTargetOptions(input({
      stack: stackOf(DYNAMIC_POSITION, PAGE),
      resources: buildResources(dataPageStore),
      isDataPage: false,
    }))
    expect(result.options).toEqual([])
  })

  test('offers nothing where add-component offers nothing on a data page', () => {
    const result = cloneTargetOptions(input({
      stack: stackOf(COMPONENT, POSITION, PAGE),
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

  test('names the scope being switched to', () => {
    const layoutStore = { ...pageStore, [LAYOUT]: { componentGroups: [GROUP] } }
    const layoutStack = stackOf(COMPONENT, POSITION, GROUP, LAYOUT)
    expect(cloneTargetOptions(input({ stack: layoutStack, resources: buildResources(layoutStore), type: 'layout' })).scope).toEqual({ type: 'layout', switching: true })
    expect(cloneTargetOptions(input({ isEditingLayout: true, type: 'page' })).scope).toEqual({ type: 'page', switching: true })
  })

  test('a layout target while already editing the layout still says it is shared by every page', () => {
    const layoutStore = { ...pageStore, [LAYOUT]: { componentGroups: [GROUP] } }
    const layoutStack = stackOf(COMPONENT, POSITION, GROUP, LAYOUT)
    expect(cloneTargetOptions(input({ stack: layoutStack, resources: buildResources(layoutStore), type: 'layout', isEditingLayout: true })).scope).toEqual({ type: 'layout', switching: false })
  })

  describe('a move', () => {
    const move = (positionIri: string, fromLayout = false) => ({ positionIri, fromLayout })

    test('is not offered next to the position being moved, as it is already there', () => {
      const resources = buildResources({ ...pageStore, [POSITION]: { component: SOURCE, componentGroup: GROUP } })
      expect(summary(cloneTargetOptions(input({ resources, stack: stackOf(SOURCE, POSITION, GROUP, PAGE), move: move(POSITION) })))).toEqual([
        { label: 'Add before', disabled: true, reasons: ['This is where it already is'] },
        { label: 'Add after', disabled: true, reasons: ['This is where it already is'] },
      ])
    })

    test('elsewhere in its own full group is allowed, as a move does not add to the group', () => {
      const resources = buildResources({ ...pageStore, [GROUP]: { ...pageStore[GROUP], maxComponents: 2 }, [POSITION_2]: { component: SOURCE, componentGroup: GROUP } })
      expect(summary(cloneTargetOptions(input({ resources, move: move(POSITION_2) })))).toEqual([
        { label: 'Add before', ...ENABLED },
        { label: 'Add after', ...ENABLED },
      ])
    })

    test('into another full group is disabled with the reason', () => {
      const resources = buildResources({ ...pageStore, [GROUP]: { ...pageStore[GROUP], maxComponents: 2 }, '/_/component_positions/elsewhere': { component: SOURCE, componentGroup: EMPTY_GROUP } })
      expect(summary(cloneTargetOptions(input({ resources, move: move('/_/component_positions/elsewhere') })))).toEqual([
        { label: 'Add before', disabled: true, reasons: ['This group is full'] },
        { label: 'Add after', disabled: true, reasons: ['This group is full'] },
      ])
    })

    test('into its own subtree names the component being moved', () => {
      const result = cloneTargetOptions(input({ stack: stackOf(COMPONENT, POSITION, GROUP, SOURCE), resources: buildResources({ ...pageStore, [SOURCE]: { '@type': 'HtmlContent', 'componentGroups': [GROUP] } }), move: move('/_/component_positions/other') }))
      expect(result.options.every(option => option.reasons.includes('This is inside the component being moved'))).toBe(true)
    })

    test('into a page-data slot is disabled with the reason', () => {
      const result = cloneTargetOptions(input({
        stack: stackOf(COMPONENT, DYNAMIC_POSITION, PAGE),
        resources: buildResources(dataPageStore),
        isDataPage: true,
        move: move(POSITION),
      }))
      expect(summary(result)).toEqual([
        { label: 'Use here', disabled: true, reasons: ['Moving into a page-data slot is not supported yet'] },
      ])
    })

    test('from the layout into the page says it will leave every other page', () => {
      expect(cloneTargetOptions(input({ isEditingLayout: true, move: move(POSITION_2, true) })).leavesLayout).toBe(true)
      expect(cloneTargetOptions(input({ move: move(POSITION_2, false) })).leavesLayout).toBeUndefined()
      expect(cloneTargetOptions(input({ isEditingLayout: true, type: 'layout', move: move(POSITION_2, true) })).leavesLayout).toBeUndefined()
      expect(cloneTargetOptions(input({ isEditingLayout: true })).leavesLayout).toBeUndefined()
    })
  })

  test('a missing source type disables every option', () => {
    const result = cloneTargetOptions(input({ sourceIri: '/component/unknowns/x', sourceType: undefined }))
    expect(summary(result)).toEqual([
      { label: 'Add before', disabled: true, reasons: ['This component type is not known'] },
      { label: 'Add after', disabled: true, reasons: ['This component type is not known'] },
    ])
  })
})

describe('display names in reasons (#414)', () => {
  const resourcesConfig = { HtmlContent: { name: 'Body Text' }, Container: { name: 'Container Block' } }

  test('a group that does not allow the type names it by its display name', () => {
    const resources = buildResources({ ...pageStore, [GROUP]: { ...pageStore[GROUP], allowedComponents: ['/component/containers'] } })
    expect(summary(cloneTargetOptions(input({ resources, resourcesConfig })))[0]!.reasons).toEqual(['This group does not allow Body Text'])
  })

  test('a page-data field of another type names both types by their display names', () => {
    const result = cloneTargetOptions(input({
      stack: stackOf(DYNAMIC_POSITION, PAGE),
      resources: buildResources({
        ...pageStore,
        [DYNAMIC_POSITION]: { pageDataProperty: 'banner' },
        [PAGE_DATA]: { _metadata: { pageDataMetadata: { properties: [{ property: 'banner', componentShortName: 'Container' }] } } },
      }),
      isDataPage: true,
      resourcesConfig,
    }))
    expect(summary(result)[0]!.reasons).toEqual(['This field takes Container Block, not Body Text'])
  })

  test('a type with no configured name keeps its type name', () => {
    const resources = buildResources({ ...pageStore, [GROUP]: { ...pageStore[GROUP], allowedComponents: ['/component/containers'] } })
    expect(summary(cloneTargetOptions(input({ resources, resourcesConfig: {} })))[0]!.reasons).toEqual(['This group does not allow HtmlContent'])
  })
})

describe('a clone into an occupied page-data slot (#415)', () => {
  const OCCUPANT = '/component/html_contents/occupant'
  const DRAFT = '/component/html_contents/source-draft'
  function slotWith(value: string | null | undefined) {
    return buildResources({
      ...pageStore,
      [DYNAMIC_POSITION]: { pageDataProperty: 'hero' },
      [PAGE_DATA]: { hero: value, _metadata: { pageDataMetadata: { properties: [{ property: 'hero', componentShortName: 'HtmlContent' }] } } },
      [OCCUPANT]: { '@type': 'HtmlContent' },
    }, [[SOURCE, DRAFT]])
  }
  function useHere(resources: CloneTargetOptionsInput['resources'], overrides: Partial<CloneTargetOptionsInput> = {}) {
    return cloneTargetOptions(input({ stack: stackOf(DYNAMIC_POSITION, PAGE), resources, isDataPage: true, ...overrides })).options[0]!
  }

  test('warns that it replaces the component the slot holds, by its display name', () => {
    const option = useHere(slotWith(OCCUPANT), { resourcesConfig: { HtmlContent: { name: 'Body Text' } } })
    expect(option.warning).toBe('This replaces Body Text')
    expect(option.disabled).toBe(false)
  })

  test('falls back to the @type of the component it replaces', () => {
    expect(useHere(slotWith(OCCUPANT)).warning).toBe('This replaces HtmlContent')
  })

  test.each([
    ['empty', null],
    ['unset', undefined],
    ['holding the source', SOURCE],
    ['holding the draft of the source', DRAFT],
  ])('gives no warning when the slot is %s', (_label, value) => {
    expect(useHere(slotWith(value)).warning).toBeUndefined()
  })

  test('a group option gives no replace warning', () => {
    const result = cloneTargetOptions(input({ resources: slotWith(OCCUPANT) }))
    expect(result.options.every(option => option.warning === undefined)).toBe(true)
  })
})

describe('sharedReasons', () => {
  const disabled = (...reasons: string[]) => ({ label: 'x', value: { kind: 'position', groupIri: GROUP, anchor: {} } as const, disabled: true, reasons })

  test('gives the reasons every option shares, so they are said once', () => {
    expect(sharedReasons([disabled('This group is full', 'This is where it already is'), disabled('This group is full')])).toEqual(['This group is full'])
  })

  test('gives nothing when any option is enabled', () => {
    expect(sharedReasons([disabled('This group is full'), { ...disabled(), disabled: false }])).toEqual([])
  })

  test('gives nothing for no options', () => {
    expect(sharedReasons([])).toEqual([])
  })
})

describe('cloneAnchorIndex', () => {
  test('is the position the options anchor before or after, beneath the clicked group', () => {
    expect(cloneAnchorIndex(stackOf(COMPONENT, POSITION, GROUP, PAGE))).toBe(1)
    expect(cloneAnchorIndex(stackOf(INNER_COMPONENT, INNER_POSITION, CONTAINER_GROUP, INNER_CONTAINER, POSITION, GROUP, PAGE))).toBe(1)
  })

  test('is nothing when the group itself was clicked, or no group was', () => {
    expect(cloneAnchorIndex(stackOf(GROUP, PAGE))).toBeUndefined()
    expect(cloneAnchorIndex(stackOf(COMPONENT, DYNAMIC_POSITION, PAGE))).toBeUndefined()
  })
})
