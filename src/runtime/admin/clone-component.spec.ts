// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from 'vitest'
import { computed, reactive } from 'vue'
import { ResourceTypeFromIri } from '../resources/resource-utils'
import { ErrorType } from '../storage/stores/error/state'
import type { CwaErrorEvent } from '../storage/stores/error/state'
import { useCloneMode } from './clone-mode'
import { cloneComponent } from './clone-component'
import type Cwa from '#cwa/cwa'

const DRAFT_IRI = '/component/html_contents/draft-uuid'
const PUBLISHED_IRI = '/component/html_contents/published-uuid'
const GROUP_IRI = '/_/component_groups/target-group'
const POSITION_IRI = '/_/component_positions/target-position'
const DYNAMIC_POSITION_IRI = '/_/component_positions/dynamic-position'
const PAGE_DATA_IRI = '/page_data/blog-article'
const CREATED_POSITION = { '@id': '/_/component_positions/new', '@type': 'ComponentPosition' }

const cwas: Cwa[] = []

function buildCwa(ops: { published?: Record<string, string | undefined>, pageData?: Record<string, string | undefined> } = {}) {
  const errors = reactive<CwaErrorEvent[]>([])
  const order: string[] = []
  const admin = reactive({
    isEditing: true,
    setNavigationGuardDisabled: vi.fn(),
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
    findPublishedComponentIri: vi.fn((iri: string) => computed(() => ops.published ? ops.published[iri] : iri)),
    pageDataIriOf: vi.fn((iri: string) => computed(() => (ops.pageData ?? { [DYNAMIC_POSITION_IRI]: PAGE_DATA_IRI })[iri])),
  }
  const $cwa = { admin, auth, resourcesManager, resources } as unknown as Cwa
  cwas.push($cwa)
  return { $cwa, resourcesManager, resources, errors, order }
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
