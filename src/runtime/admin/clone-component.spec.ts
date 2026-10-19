// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from 'vitest'
import { computed, nextTick, reactive, ref } from 'vue'
import { ResourceTypeFromIri } from '../resources/resource-utils'
import { ErrorType } from '../storage/stores/error/state'
import type { CwaErrorEvent } from '../storage/stores/error/state'
import { useCloneMode } from './clone-mode'
import { cloneComponent, moveComponent } from './clone-component'
import { registerInstance } from './manageable-instances'
import type Cwa from '#cwa/cwa'

const DRAFT_IRI = '/component/html_contents/draft-uuid'
const PUBLISHED_IRI = '/component/html_contents/published-uuid'
const GROUP_IRI = '/_/component_groups/target-group'
const POSITION_IRI = '/_/component_positions/target-position'
const DYNAMIC_POSITION_IRI = '/_/component_positions/dynamic-position'
const PAGE_DATA_IRI = '/page_data/blog-article'
const SOURCE_POSITION_IRI = '/_/component_positions/source-position'
const SOURCE_GROUP_IRI = '/_/component_groups/source-group'
const CREATED_POSITION = { '@id': '/_/component_positions/new', '@type': 'ComponentPosition' }

const cwas: Cwa[] = []

function buildCwa(ops: { published?: Record<string, string | undefined>, pageData?: Record<string, string | undefined>, sourceGroup?: string, currentIds?: string[] } = {}) {
  const errors = reactive<CwaErrorEvent[]>([])
  const order: string[] = []
  const admin = reactive({
    isEditing: true,
    setNavigationGuardDisabled: vi.fn(),
    eventBus: { emit: vi.fn() },
  })
  const auth = reactive({ user: { '@id': '/_/users/admin' } as Record<string, any> | undefined })
  const resourcesManager = {
    get errors() {
      return errors
    },
    createResource: vi.fn(async (_event: any) => {
      order.push('createResource')
      return CREATED_POSITION
    }),
    updateResource: vi.fn(async (_event: any) => {
      order.push('updateResource')
      return { '@id': PAGE_DATA_IRI }
    }),
    queueComponentGroupWrite: vi.fn(async (_groupIri: string, write: () => Promise<any>) => {
      order.push('queue:start')
      const result = await write()
      order.push('queue:end')
      return result
    }),
    refreshComponentGroupOrder: vi.fn(async (_groupIri: string) => {
      order.push('refreshComponentGroupOrder')
    }),
    refreshEndpoints: vi.fn(async (_paths: string[]) => {
      order.push('refreshEndpoints')
    }),
    send: vi.fn(async (_endpoint: string, _method: string, _body: any): Promise<{ componentPosition: string | null } | undefined> => {
      order.push('send')
      return { componentPosition: SOURCE_POSITION_IRI }
    }),
    removeResource: vi.fn(),
    addError: vi.fn((error: CwaErrorEvent) => {
      errors.push(error)
    }),
    removeError: vi.fn((id: number) => {
      const index = errors.findIndex(error => error.timestamp === id)
      index !== -1 && errors.splice(index, 1)
    }),
  }
  const resources = {
    displayPageIri: computed(() => undefined),
    currentIds: ops.currentIds ?? [],
    getResource: vi.fn((iri: string) => computed(() => iri === SOURCE_POSITION_IRI ? { data: { componentGroup: ops.sourceGroup ?? SOURCE_GROUP_IRI } } : undefined)),
    findPublishedComponentIri: vi.fn((iri: string) => computed(() => ops.published ? ops.published[iri] : iri)),
    pageDataIriOf: vi.fn((iri: string) => computed(() => (ops.pageData ?? { [DYNAMIC_POSITION_IRI]: PAGE_DATA_IRI })[iri])),
    findAllPublishableIris: vi.fn((iri: string) => [iri]),
  }
  const $cwa = { admin, auth, resourcesManager, resources } as unknown as Cwa
  cwas.push($cwa)
  return { $cwa, admin, resourcesManager, resources, errors, order }
}

function failWith(errors: CwaErrorEvent[], endpoint: string, statusCode: number, detail: string) {
  return async () => {
    errors.push({
      event: { endpoint, data: {} },
      type: statusCode === 422 ? ErrorType.VALIDATION : ErrorType.SERVER,
      statusCode,
      detail,
      violations: statusCode === 422 ? [{ property: 'component', message: detail }] : [],
      timestamp: 1000 + statusCode,
    })
    return undefined
  }
}

function unrelatedNotFound(): CwaErrorEvent {
  return {
    event: { endpoint: '/_/component_positions/other', data: {} },
    type: ErrorType.SERVER,
    statusCode: 404,
    detail: 'Unrelated',
    violations: [],
    timestamp: 1,
  }
}

describe('cloneComponent', () => {
  afterEach(() => {
    cwas.forEach($cwa => useCloneMode($cwa).end())
    cwas.length = 0
    ResourceTypeFromIri.setPathPrefix(undefined)
    vi.useRealTimers()
  })

  test('posts a position holding the source IRI after the target position through the group\'s write queue', async () => {
    ResourceTypeFromIri.setPathPrefix('/_api')
    const { $cwa, resourcesManager, order } = buildCwa()
    const result = await cloneComponent($cwa, {
      sourceIri: PUBLISHED_IRI,
      target: { kind: 'position', groupIri: GROUP_IRI, anchor: { after: POSITION_IRI } },
    })
    expect(result).toBe('added')
    expect(resourcesManager.queueComponentGroupWrite).toHaveBeenCalledTimes(1)
    expect(resourcesManager.queueComponentGroupWrite).toHaveBeenCalledWith(GROUP_IRI, expect.any(Function))
    expect(resourcesManager.createResource).toHaveBeenCalledTimes(1)
    expect(resourcesManager.createResource).toHaveBeenCalledWith({
      endpoint: '/_api/_/component_positions',
      data: { componentGroup: GROUP_IRI, component: PUBLISHED_IRI, after: POSITION_IRI },
      refreshEndpoints: [GROUP_IRI],
    })
    expect(order).toEqual(['queue:start', 'createResource', 'refreshComponentGroupOrder', 'queue:end'])
    expect(resourcesManager.refreshEndpoints).not.toHaveBeenCalled()
    expect(resourcesManager.updateResource).not.toHaveBeenCalled()
  })

  test.each([
    ['Add before', { before: POSITION_IRI }, { before: POSITION_IRI }],
    ['Add to End', {}, {}],
    ['Add here', {}, {}],
  ])('Add before sends before, Add to End and Add here send no anchor: %s', async (_label, anchor, expected) => {
    const { $cwa, resourcesManager } = buildCwa()
    await cloneComponent($cwa, {
      sourceIri: PUBLISHED_IRI,
      target: { kind: 'position', groupIri: GROUP_IRI, anchor },
    })
    expect(resourcesManager.createResource).toHaveBeenCalledWith(expect.objectContaining({
      endpoint: '/_/component_positions',
      data: { componentGroup: GROUP_IRI, component: PUBLISHED_IRI, ...expected },
    }))
  })

  test('never sends a sortValue', async () => {
    const { $cwa, resourcesManager } = buildCwa()
    await cloneComponent($cwa, {
      sourceIri: PUBLISHED_IRI,
      target: { kind: 'position', groupIri: GROUP_IRI, anchor: { after: POSITION_IRI } },
    })
    expect(resourcesManager.createResource).toHaveBeenCalledTimes(1)
    expect(resourcesManager.createResource.mock.calls[0]![0].data).not.toHaveProperty('sortValue')
  })

  test('reads the group\'s order exactly once after the insert (#400)', async () => {
    const { $cwa, resourcesManager } = buildCwa()
    await cloneComponent($cwa, {
      sourceIri: PUBLISHED_IRI,
      target: { kind: 'position', groupIri: GROUP_IRI, anchor: {} },
    })
    expect(resourcesManager.refreshComponentGroupOrder).toHaveBeenCalledTimes(1)
    expect(resourcesManager.refreshComponentGroupOrder).toHaveBeenCalledWith(GROUP_IRI)
  })

  test('sends the published IRI when the selected source is a draft of a published component', async () => {
    const { $cwa, resourcesManager, resources } = buildCwa({ published: { [DRAFT_IRI]: PUBLISHED_IRI } })
    await cloneComponent($cwa, {
      sourceIri: DRAFT_IRI,
      target: { kind: 'position', groupIri: GROUP_IRI, anchor: {} },
    })
    expect(resources.findPublishedComponentIri).toHaveBeenCalledWith(DRAFT_IRI)
    expect(resourcesManager.createResource).toHaveBeenCalledWith(expect.objectContaining({
      data: { componentGroup: GROUP_IRI, component: PUBLISHED_IRI },
    }))
  })

  test('sends the draft IRI for a never-published draft', async () => {
    const { $cwa, resourcesManager, resources } = buildCwa({ published: { [DRAFT_IRI]: undefined } })
    await cloneComponent($cwa, {
      sourceIri: DRAFT_IRI,
      target: { kind: 'position', groupIri: GROUP_IRI, anchor: {} },
    })
    expect(resources.findPublishedComponentIri).toHaveBeenCalledWith(DRAFT_IRI)
    expect(resourcesManager.createResource).toHaveBeenCalledWith(expect.objectContaining({
      data: { componentGroup: GROUP_IRI, component: DRAFT_IRI },
    }))
  })

  test('a page-data slot patches the page data at the position\'s depth with the source IRI', async () => {
    const { $cwa, resourcesManager, resources } = buildCwa({ published: { [DRAFT_IRI]: PUBLISHED_IRI } })
    const result = await cloneComponent($cwa, {
      sourceIri: DRAFT_IRI,
      target: { kind: 'page-data', positionIri: DYNAMIC_POSITION_IRI, property: 'heroComponent' },
    })
    expect(result).toBe('added')
    expect(resources.pageDataIriOf).toHaveBeenCalledWith(DYNAMIC_POSITION_IRI)
    expect(resourcesManager.updateResource).toHaveBeenCalledTimes(1)
    expect(resourcesManager.updateResource).toHaveBeenCalledWith({
      endpoint: PAGE_DATA_IRI,
      data: { heroComponent: PUBLISHED_IRI },
      refreshEndpoints: [DYNAMIC_POSITION_IRI],
    })
    expect(resourcesManager.queueComponentGroupWrite).not.toHaveBeenCalled()
    expect(resourcesManager.createResource).not.toHaveBeenCalled()
  })

  test('a page-data slot with no page data at the position\'s depth sends nothing and keeps clone mode on', async () => {
    const { $cwa, resourcesManager } = buildCwa({ pageData: {} })
    useCloneMode($cwa).start(PUBLISHED_IRI, 'Hero')
    const result = await cloneComponent($cwa, {
      sourceIri: PUBLISHED_IRI,
      target: { kind: 'page-data', positionIri: DYNAMIC_POSITION_IRI, property: 'heroComponent' },
    })
    expect(result).toBe('refused')
    expect(resourcesManager.updateResource).not.toHaveBeenCalled()
    expect(useCloneMode($cwa).source.value).toEqual({ iri: PUBLISHED_IRI, name: 'Hero' })
  })

  test.each([
    ['position', { kind: 'position', groupIri: GROUP_IRI, anchor: {} }],
    ['page-data', { kind: 'page-data', positionIri: DYNAMIC_POSITION_IRI, property: 'heroComponent' }],
  ] as const)('ends clone mode after a successful add: %s', async (_kind, target) => {
    const { $cwa } = buildCwa()
    useCloneMode($cwa).start(PUBLISHED_IRI, 'Hero')
    const result = await cloneComponent($cwa, { sourceIri: PUBLISHED_IRI, target })
    expect(result).toBe('added')
    expect(useCloneMode($cwa).source.value).toBeUndefined()
  })

  test.each([
    ['position', '/_/component_positions', { kind: 'position', groupIri: GROUP_IRI, anchor: {} }, 'createResource'],
    ['page-data', PAGE_DATA_IRI, { kind: 'page-data', positionIri: DYNAMIC_POSITION_IRI, property: 'heroComponent' }, 'updateResource'],
  ] as const)('a 422 keeps clone mode on and leaves the API error shown: %s', async (_kind, endpoint, target, request) => {
    const { $cwa, resourcesManager, errors } = buildCwa()
    resourcesManager[request].mockImplementationOnce(async () => {
      const result = await failWith(errors, endpoint, 422, 'This component cannot be placed inside itself.')()
      errors.push(unrelatedNotFound())
      return result
    })
    useCloneMode($cwa).start(PUBLISHED_IRI, 'Hero')
    const result = await cloneComponent($cwa, { sourceIri: PUBLISHED_IRI, target })
    expect(resourcesManager[request]).toHaveBeenCalledTimes(1)
    expect(result).toBe('refused')
    expect(useCloneMode($cwa).source.value).toEqual({ iri: PUBLISHED_IRI, name: 'Hero' })
    expect(errors.map(error => error.detail)).toEqual(['This component cannot be placed inside itself.', 'Unrelated'])
    expect(resourcesManager.addError).not.toHaveBeenCalled()
    expect(resourcesManager.removeError).not.toHaveBeenCalled()
  })

  test('a refused insert re-reads the group before reading its order once, as add-component does', async () => {
    const { $cwa, resourcesManager, errors, order } = buildCwa()
    resourcesManager.createResource.mockImplementationOnce(failWith(errors, '/_/component_positions', 422, 'This group is full.'))
    await cloneComponent($cwa, {
      sourceIri: PUBLISHED_IRI,
      target: { kind: 'position', groupIri: GROUP_IRI, anchor: {} },
    })
    expect(resourcesManager.refreshEndpoints).toHaveBeenCalledTimes(1)
    expect(resourcesManager.refreshEndpoints).toHaveBeenCalledWith([GROUP_IRI])
    expect(resourcesManager.refreshComponentGroupOrder).toHaveBeenCalledTimes(1)
    expect(order).toEqual(['queue:start', 'refreshEndpoints', 'refreshComponentGroupOrder', 'queue:end'])
  })

  test('a server error keeps clone mode on and leaves the API error shown', async () => {
    const { $cwa, resourcesManager, errors } = buildCwa()
    resourcesManager.createResource.mockImplementationOnce(failWith(errors, '/_/component_positions', 500, 'Internal Server Error'))
    useCloneMode($cwa).start(PUBLISHED_IRI, 'Hero')
    const result = await cloneComponent($cwa, {
      sourceIri: PUBLISHED_IRI,
      target: { kind: 'position', groupIri: GROUP_IRI, anchor: {} },
    })
    expect(result).toBe('refused')
    expect(useCloneMode($cwa).source.value).toEqual({ iri: PUBLISHED_IRI, name: 'Hero' })
    expect(errors.map(error => error.detail)).toEqual(['Internal Server Error'])
  })

  test.each([
    ['position', '/_/component_positions', { kind: 'position', groupIri: GROUP_IRI, anchor: {} }, 'createResource'],
    ['page-data', PAGE_DATA_IRI, { kind: 'page-data', positionIri: DYNAMIC_POSITION_IRI, property: 'heroComponent' }, 'updateResource'],
  ] as const)('a 404 shows that the component being cloned no longer exists and ends clone mode: %s', async (_kind, endpoint, target, request) => {
    const { $cwa, resourcesManager, errors } = buildCwa()
    errors.push(unrelatedNotFound())
    resourcesManager[request].mockImplementationOnce(failWith(errors, endpoint, 404, 'Not Found'))
    useCloneMode($cwa).start(PUBLISHED_IRI, 'Hero')
    const result = await cloneComponent($cwa, { sourceIri: PUBLISHED_IRI, target })
    expect(result).toBe('source-gone')
    expect(useCloneMode($cwa).source.value).toBeUndefined()
    expect(resourcesManager.removeError).toHaveBeenCalledWith(1404)
    expect(resourcesManager.addError).toHaveBeenCalledTimes(1)
    expect(resourcesManager.addError).toHaveBeenCalledWith(expect.objectContaining({
      type: ErrorType.SERVER,
      statusCode: 404,
      detail: 'The component being cloned no longer exists',
    }))
    expect(errors.map(error => error.detail)).toEqual(['Unrelated', 'The component being cloned no longer exists'])
  })
})

describe('cloneComponent when the API refuses the source as an unknown IRI (#411)', () => {
  afterEach(() => {
    cwas.forEach($cwa => useCloneMode($cwa).end())
    cwas.length = 0
  })

  test.each([
    ['position', '/_/component_positions', { kind: 'position', groupIri: GROUP_IRI, anchor: {} }, 'createResource'],
    ['page-data', PAGE_DATA_IRI, { kind: 'page-data', positionIri: DYNAMIC_POSITION_IRI, property: 'heroComponent' }, 'updateResource'],
  ] as const)('a 400 "Item not found" naming the source shows that it no longer exists and ends clone mode: %s', async (_kind, endpoint, target, request) => {
    const { $cwa, resourcesManager, errors } = buildCwa()
    resourcesManager[request].mockImplementationOnce(failWith(errors, endpoint, 400, `Item not found for "${PUBLISHED_IRI}".`))
    useCloneMode($cwa).start(PUBLISHED_IRI, 'Hero')
    const result = await cloneComponent($cwa, { sourceIri: PUBLISHED_IRI, target })
    expect(result).toBe('source-gone')
    expect(useCloneMode($cwa).source.value).toBeUndefined()
    expect(errors.map(error => error.detail)).toEqual(['The component being cloned no longer exists'])
  })

  test.each([
    ['names another resource', `Item not found for "${GROUP_IRI}".`],
    ['is another bad request', 'Invalid IRI'],
  ])('a 400 that %s keeps clone mode on and leaves the API error shown', async (_label, detail) => {
    const { $cwa, resourcesManager, errors } = buildCwa()
    resourcesManager.createResource.mockImplementationOnce(failWith(errors, '/_/component_positions', 400, detail))
    useCloneMode($cwa).start(PUBLISHED_IRI, 'Hero')
    const result = await cloneComponent($cwa, { sourceIri: PUBLISHED_IRI, target: { kind: 'position', groupIri: GROUP_IRI, anchor: {} } })
    expect(result).toBe('refused')
    expect(useCloneMode($cwa).source.value).toBeDefined()
    expect(errors.map(error => error.detail)).toEqual([detail])
  })
})

describe('moveComponent (#415, api-components-bundle#526)', () => {
  const OTHER_PAGE_DATA_IRI = '/page_data/other-article'
  const MOVED_POSITION_IRI = '/_/component_positions/moved'
  const fromPosition = { positionIri: SOURCE_POSITION_IRI, fromLayout: false, from: { componentPosition: SOURCE_POSITION_IRI } }
  const fromSlot = { positionIri: DYNAMIC_POSITION_IRI, fromLayout: false, from: { pageData: OTHER_PAGE_DATA_IRI, property: 'heroComponent' } }
  const toGroup = { kind: 'position', groupIri: GROUP_IRI, anchor: { after: POSITION_IRI } } as const
  const toSlot = { kind: 'page-data', positionIri: DYNAMIC_POSITION_IRI, property: 'heroComponent' } as const

  afterEach(() => {
    cwas.forEach($cwa => useCloneMode($cwa).end())
    cwas.length = 0
  })

  function refuseMove(errors: CwaErrorEvent[], statusCode: number, property: string | undefined, detail: string) {
    return async () => {
      errors.push({
        event: { endpoint: `${PUBLISHED_IRI}/move`, data: {} },
        type: statusCode === 422 ? ErrorType.VALIDATION : ErrorType.SERVER,
        statusCode,
        detail,
        violations: property === undefined ? [] : [{ property, message: detail }],
        timestamp: 2000 + statusCode,
      })
      return undefined
    }
  }

  test('a position into a group POSTs the published component\'s move through the target group\'s write queue, then re-reads the position and both groups', async () => {
    const { $cwa, resourcesManager, order } = buildCwa({ published: { [DRAFT_IRI]: PUBLISHED_IRI }, currentIds: [SOURCE_POSITION_IRI] })
    useCloneMode($cwa).start(DRAFT_IRI, 'Hero', fromPosition)
    const result = await moveComponent($cwa, { sourceIri: DRAFT_IRI, move: fromPosition, target: toGroup })
    expect(result).toBe('added')
    expect(resourcesManager.queueComponentGroupWrite).toHaveBeenCalledTimes(1)
    expect(resourcesManager.queueComponentGroupWrite).toHaveBeenCalledWith(GROUP_IRI, expect.any(Function))
    expect(resourcesManager.send).toHaveBeenCalledTimes(1)
    expect(resourcesManager.send).toHaveBeenCalledWith(`${PUBLISHED_IRI}/move`, 'POST', {
      from: { componentPosition: SOURCE_POSITION_IRI },
      to: { componentGroup: GROUP_IRI, after: POSITION_IRI },
    })
    expect(resourcesManager.refreshEndpoints.mock.calls).toEqual([[[SOURCE_POSITION_IRI, GROUP_IRI, SOURCE_GROUP_IRI]]])
    expect(resourcesManager.refreshComponentGroupOrder.mock.calls).toEqual([[GROUP_IRI], [SOURCE_GROUP_IRI]])
    expect(order).toEqual(['queue:start', 'send', 'refreshEndpoints', 'refreshComponentGroupOrder', 'refreshComponentGroupOrder', 'queue:end'])
    expect(resourcesManager.updateResource).not.toHaveBeenCalled()
    expect(resourcesManager.createResource).not.toHaveBeenCalled()
    expect(resourcesManager.removeResource).not.toHaveBeenCalled()
    expect(useCloneMode($cwa).source.value).toBeUndefined()
  })

  test('a move within its own group re-reads that group\'s order once', async () => {
    const { $cwa, resourcesManager } = buildCwa({ sourceGroup: GROUP_IRI })
    await moveComponent($cwa, { sourceIri: PUBLISHED_IRI, move: fromPosition, target: { kind: 'position', groupIri: GROUP_IRI, anchor: { before: POSITION_IRI } } })
    expect(resourcesManager.send).toHaveBeenCalledWith(`${PUBLISHED_IRI}/move`, 'POST', {
      from: { componentPosition: SOURCE_POSITION_IRI },
      to: { componentGroup: GROUP_IRI, before: POSITION_IRI },
    })
    expect(resourcesManager.refreshComponentGroupOrder.mock.calls).toEqual([[GROUP_IRI]])
  })

  test('a position into a page-data slot moves it into the page data at the slot\'s depth through the source group\'s write queue, and drops the deleted position', async () => {
    const { $cwa, resourcesManager, resources, order } = buildCwa()
    resourcesManager.send.mockImplementationOnce(async () => {
      order.push('send')
      return { componentPosition: null }
    })
    const result = await moveComponent($cwa, { sourceIri: PUBLISHED_IRI, move: fromPosition, target: toSlot })
    expect(result).toBe('added')
    expect(resources.pageDataIriOf).toHaveBeenCalledWith(DYNAMIC_POSITION_IRI)
    expect(resourcesManager.send).toHaveBeenCalledWith(`${PUBLISHED_IRI}/move`, 'POST', {
      from: { componentPosition: SOURCE_POSITION_IRI },
      to: { pageData: PAGE_DATA_IRI, property: 'heroComponent' },
    })
    expect(resourcesManager.queueComponentGroupWrite).toHaveBeenCalledWith(SOURCE_GROUP_IRI, expect.any(Function))
    expect(resourcesManager.removeResource).toHaveBeenCalledWith({ resource: SOURCE_POSITION_IRI })
    expect(resourcesManager.refreshEndpoints.mock.calls).toEqual([[[PAGE_DATA_IRI, DYNAMIC_POSITION_IRI, SOURCE_GROUP_IRI]]])
    expect(resourcesManager.refreshComponentGroupOrder.mock.calls).toEqual([[SOURCE_GROUP_IRI]])
    expect(useCloneMode($cwa).placed.value).toBe(DYNAMIC_POSITION_IRI)
  })

  test('a slot sends the page data and property recorded when Move started, never the page data on screen now', async () => {
    const { $cwa, resourcesManager } = buildCwa()
    resourcesManager.send.mockResolvedValueOnce({ componentPosition: MOVED_POSITION_IRI })
    const result = await moveComponent($cwa, { sourceIri: PUBLISHED_IRI, move: fromSlot, target: toGroup })
    expect(result).toBe('added')
    expect(resourcesManager.send).toHaveBeenCalledWith(`${PUBLISHED_IRI}/move`, 'POST', {
      from: { pageData: OTHER_PAGE_DATA_IRI, property: 'heroComponent' },
      to: { componentGroup: GROUP_IRI, after: POSITION_IRI },
    })
    expect(resourcesManager.queueComponentGroupWrite).toHaveBeenCalledWith(GROUP_IRI, expect.any(Function))
    expect(resourcesManager.refreshEndpoints.mock.calls).toEqual([[[GROUP_IRI]]])
    expect(resourcesManager.refreshComponentGroupOrder.mock.calls).toEqual([[GROUP_IRI]])
    expect(resourcesManager.removeResource).not.toHaveBeenCalled()
  })

  test('a slot on screen re-reads its page data and position after the move', async () => {
    const { $cwa, resourcesManager } = buildCwa({ currentIds: [OTHER_PAGE_DATA_IRI, DYNAMIC_POSITION_IRI] })
    resourcesManager.send.mockResolvedValueOnce({ componentPosition: MOVED_POSITION_IRI })
    await moveComponent($cwa, { sourceIri: PUBLISHED_IRI, move: fromSlot, target: toGroup })
    expect(resourcesManager.refreshEndpoints.mock.calls).toEqual([[[OTHER_PAGE_DATA_IRI, DYNAMIC_POSITION_IRI, GROUP_IRI]]])
  })

  test('the same slot on another page-data page moves from the recorded page data to the one on screen, with no group write', async () => {
    const { $cwa, resourcesManager } = buildCwa()
    resourcesManager.send.mockResolvedValueOnce({ componentPosition: null })
    const result = await moveComponent($cwa, { sourceIri: PUBLISHED_IRI, move: fromSlot, target: toSlot })
    expect(result).toBe('added')
    expect(resourcesManager.send).toHaveBeenCalledWith(`${PUBLISHED_IRI}/move`, 'POST', {
      from: { pageData: OTHER_PAGE_DATA_IRI, property: 'heroComponent' },
      to: { pageData: PAGE_DATA_IRI, property: 'heroComponent' },
    })
    expect(resourcesManager.queueComponentGroupWrite).not.toHaveBeenCalled()
    expect(resourcesManager.refreshEndpoints.mock.calls).toEqual([[[PAGE_DATA_IRI, DYNAMIC_POSITION_IRI]]])
    expect(resourcesManager.refreshComponentGroupOrder).not.toHaveBeenCalled()
  })

  test('a slot target with no page data at its depth sends nothing and keeps move mode on', async () => {
    const { $cwa, resourcesManager } = buildCwa({ pageData: {} })
    useCloneMode($cwa).start(PUBLISHED_IRI, 'Hero', fromPosition)
    expect(await moveComponent($cwa, { sourceIri: PUBLISHED_IRI, move: fromPosition, target: toSlot })).toBe('refused')
    expect(resourcesManager.send).not.toHaveBeenCalled()
    expect(useCloneMode($cwa).source.value).toBeDefined()
  })

  test.each([
    ['from'],
    ['from.componentPosition'],
    ['from.pageData'],
    ['from.property'],
  ])('a 422 on %s says the component being moved no longer exists and ends move mode', async (property) => {
    const { $cwa, resourcesManager, errors } = buildCwa()
    errors.push(unrelatedNotFound())
    resourcesManager.send.mockImplementationOnce(refuseMove(errors, 422, property, 'This component position does not hold the component.'))
    useCloneMode($cwa).start(PUBLISHED_IRI, 'Hero', fromPosition)
    const result = await moveComponent($cwa, { sourceIri: PUBLISHED_IRI, move: fromPosition, target: toGroup })
    expect(result).toBe('source-gone')
    expect(useCloneMode($cwa).source.value).toBeUndefined()
    expect(errors.map(error => error.detail)).toEqual(['Unrelated', 'The component being moved no longer exists'])
  })

  test('a 404 for the component says the component being moved no longer exists and ends move mode', async () => {
    const { $cwa, resourcesManager, errors } = buildCwa()
    resourcesManager.send.mockImplementationOnce(refuseMove(errors, 404, undefined, 'Not Found'))
    useCloneMode($cwa).start(PUBLISHED_IRI, 'Hero', fromPosition)
    expect(await moveComponent($cwa, { sourceIri: PUBLISHED_IRI, move: fromPosition, target: toGroup })).toBe('source-gone')
    expect(errors.map(error => error.detail)).toEqual(['The component being moved no longer exists'])
    expect(useCloneMode($cwa).source.value).toBeUndefined()
  })

  test.each([
    ['a 422 on to.property', 422, 'to.property', 'This property already holds a component.'],
    ['a 422 on to.componentGroup', 422, 'to.componentGroup', 'This group is full.'],
    ['a 422 on a path that only starts with from', 422, 'fromage', 'Not about the source.'],
    ['a 403', 403, undefined, 'Access Denied.'],
    ['a 400 naming from.componentPosition', 400, 'from.componentPosition', 'Malformed.'],
  ])('%s keeps move mode on and leaves the API error shown', async (_label, statusCode, property, detail) => {
    const { $cwa, resourcesManager, errors } = buildCwa()
    resourcesManager.send.mockImplementationOnce(refuseMove(errors, statusCode, property, detail))
    useCloneMode($cwa).start(PUBLISHED_IRI, 'Hero', fromPosition)
    const result = await moveComponent($cwa, { sourceIri: PUBLISHED_IRI, move: fromPosition, target: toGroup })
    expect(result).toBe('refused')
    expect(useCloneMode($cwa).source.value).toBeDefined()
    expect(errors.map(error => error.detail)).toEqual([detail])
    expect(resourcesManager.addError).not.toHaveBeenCalled()
    expect(resourcesManager.removeResource).not.toHaveBeenCalled()
  })

  test('a refused move re-reads the groups\' order in case the server moved it, but nothing else', async () => {
    const { $cwa, resourcesManager, errors } = buildCwa({ currentIds: [SOURCE_POSITION_IRI] })
    resourcesManager.send.mockImplementationOnce(refuseMove(errors, 422, 'to.componentGroup', 'Full'))
    await moveComponent($cwa, { sourceIri: PUBLISHED_IRI, move: fromPosition, target: toGroup })
    expect(resourcesManager.refreshEndpoints).not.toHaveBeenCalled()
    expect(resourcesManager.refreshComponentGroupOrder.mock.calls).toEqual([[GROUP_IRI], [SOURCE_GROUP_IRI]])
  })
})

describe('showing what was placed', () => {
  afterEach(() => {
    cwas.forEach($cwa => useCloneMode($cwa).end())
    cwas.length = 0
    vi.useRealTimers()
  })

  async function shown($cwa: Cwa, positionIri: string) {
    registerInstance($cwa, positionIri, ref([document.createElement('div')]))
    await nextTick()
  }

  test.each([
    ['a clone into a group', () => ({ sourceIri: PUBLISHED_IRI, target: { kind: 'position', groupIri: GROUP_IRI, anchor: {} } }), CREATED_POSITION['@id']],
    ['a clone into a page-data slot', () => ({ sourceIri: PUBLISHED_IRI, target: { kind: 'page-data', positionIri: DYNAMIC_POSITION_IRI, property: 'heroComponent' } }), DYNAMIC_POSITION_IRI],
  ] as const)('%s flashes and, once it is on screen, selects the new instance', async (_label, args, placedIri) => {
    const { $cwa, admin } = buildCwa()
    useCloneMode($cwa).start(PUBLISHED_IRI, 'Hero')
    expect(await cloneComponent($cwa, args() as any)).toBe('added')
    expect(useCloneMode($cwa).placed.value).toBe(placedIri)
    await nextTick()
    expect(admin.eventBus.emit).not.toHaveBeenCalled()
    await shown($cwa, placedIri)
    expect(admin.eventBus.emit).toHaveBeenCalledTimes(1)
    expect(admin.eventBus.emit).toHaveBeenCalledWith('selectResource', placedIri)
    await shown($cwa, '/_/component_positions/later')
    await shown($cwa, placedIri)
    expect(admin.eventBus.emit).toHaveBeenCalledTimes(1)
  })

  test('a move flashes and selects the position the API returns, which is already on screen', async () => {
    const { $cwa, admin } = buildCwa()
    const move = { positionIri: SOURCE_POSITION_IRI, fromLayout: false, from: { componentPosition: SOURCE_POSITION_IRI } }
    registerInstance($cwa, SOURCE_POSITION_IRI, ref([document.createElement('div')]))
    useCloneMode($cwa).start(PUBLISHED_IRI, 'Hero', move)
    expect(await moveComponent($cwa, { sourceIri: PUBLISHED_IRI, move, target: { kind: 'position', groupIri: GROUP_IRI, anchor: {} } })).toBe('added')
    expect(useCloneMode($cwa).placed.value).toBe(SOURCE_POSITION_IRI)
    await nextTick()
    expect(admin.eventBus.emit).toHaveBeenCalledWith('selectResource', SOURCE_POSITION_IRI)
  })

  test('a move out of a slot flashes and selects the position the API created, once it is on screen', async () => {
    const { $cwa, admin, resourcesManager } = buildCwa()
    const created = '/_/component_positions/created-by-move'
    const move = { positionIri: DYNAMIC_POSITION_IRI, fromLayout: false, from: { pageData: PAGE_DATA_IRI, property: 'heroComponent' } }
    resourcesManager.send.mockResolvedValueOnce({ componentPosition: created })
    useCloneMode($cwa).start(PUBLISHED_IRI, 'Hero', move)
    expect(await moveComponent($cwa, { sourceIri: PUBLISHED_IRI, move, target: { kind: 'position', groupIri: GROUP_IRI, anchor: {} } })).toBe('added')
    expect(useCloneMode($cwa).placed.value).toBe(created)
    await nextTick()
    expect(admin.eventBus.emit).not.toHaveBeenCalled()
    await shown($cwa, created)
    expect(admin.eventBus.emit).toHaveBeenCalledWith('selectResource', created)
  })

  test('selects nothing when the placed instance never appears', async () => {
    vi.useFakeTimers()
    const { $cwa, admin } = buildCwa()
    await cloneComponent($cwa, { sourceIri: PUBLISHED_IRI, target: { kind: 'position', groupIri: GROUP_IRI, anchor: {} } })
    await nextTick()
    vi.advanceTimersByTime(5000)
    await shown($cwa, CREATED_POSITION['@id'])
    expect(admin.eventBus.emit).not.toHaveBeenCalled()
  })

  test('a refused or source-gone write places and selects nothing', async () => {
    const { $cwa, admin, resourcesManager, errors } = buildCwa()
    resourcesManager.createResource.mockImplementationOnce(failWith(errors, '/_/component_positions', 422, 'Refused'))
    resourcesManager.createResource.mockImplementationOnce(failWith(errors, '/_/component_positions', 404, 'Not Found'))
    for (const outcome of ['refused', 'source-gone']) {
      useCloneMode($cwa).start(PUBLISHED_IRI, 'Hero')
      expect(await cloneComponent($cwa, { sourceIri: PUBLISHED_IRI, target: { kind: 'position', groupIri: GROUP_IRI, anchor: {} } })).toBe(outcome)
    }
    await shown($cwa, CREATED_POSITION['@id'])
    expect(useCloneMode($cwa).placed.value).toBeUndefined()
    expect(admin.eventBus.emit).not.toHaveBeenCalled()
  })
})
