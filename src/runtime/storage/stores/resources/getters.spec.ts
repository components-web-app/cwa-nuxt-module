// @vitest-environment nuxt

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import { computed, reactive, ref } from 'vue'
import { CwaResourceTypes } from '../../../resources/resource-utils'
import type { FetchStatus } from '../fetcher/state'
import * as ResourceUtils from '../../../resources/resource-utils'
import Cwa from '../../../cwa'
import ManageableResource from '../../../admin/manageable-resource'
import type { CwaResourcesGettersInterface } from './getters'
import getters from './getters'
import type { CwaResourcesStateInterface } from './state'
import createResourcesState, { CwaResourceApiStatuses } from './state'
import { ResourcesGetterUtils } from './getter-utils'
import type { CwaResourcesActionsInterface } from './actions'
import actions from './actions'
import { ResourcesStore } from './resources-store'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('./getter-utils', () => {
  return {
    ResourcesGetterUtils: vi.fn(function () {
      return {
        resourcesApiStateIsPending: vi.fn(),
        totalResourcesPending: vi.fn(),
        currentResourcesPending: vi.fn(),
      }
    }),
  }
})

function createState(): CwaResourcesStateInterface {
  return {
    current: reactive({
      byId: {},
      allIds: [],
      currentIds: [],
    }),
    new: reactive({
      byId: {},
      allIds: [],
    }),
  }
}

function createManageableResource($el?: DummyDom) {
  const component = {
    $el: $el || createDomElement(1),
  }
  const $cwa = new Cwa()
  return {
    instance: new ManageableResource(component, $cwa, ref({ styles: { name: ['style'] } })),
    $cwa,
  }
}

describe('ResourcesStore Getters -> totalResourcesPending', () => {
  let state: CwaResourcesStateInterface
  let getterFns: CwaResourcesGettersInterface

  beforeEach(() => {
    state = createState()
    getterFns = getters(state)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  test('A computed value is returned from the utils', () => {
    vi.spyOn(ResourcesGetterUtils.mock.results[0].value, 'totalResourcesPending', 'get').mockImplementationOnce(() => {
      return 999
    })
    expect(getterFns.totalResourcesPending.value).toBe(999)
  })
})

describe('ResourcesStore Getters -> currentResourcesApiStateIsPending', () => {
  let state: CwaResourcesStateInterface
  let getterFns: CwaResourcesGettersInterface

  beforeEach(() => {
    state = createState()
    getterFns = getters(state)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  test.each([false, true])('returns %s from the utils\' check of the current resources only (#259)', (pending) => {
    const spy = vi.spyOn(ResourcesGetterUtils.mock.results[0].value, 'currentResourcesPending', 'get').mockImplementationOnce(() => pending)
    expect(getterFns.currentResourcesApiStateIsPending.value).toBe(pending)
    expect(spy).toHaveBeenCalledOnce()
    expect(ResourcesGetterUtils.mock.results[0].value.resourcesApiStateIsPending).not.toHaveBeenCalled()
  })
})

describe('ResourcesStore Getters -> resourcesApiStateIsPending', () => {
  let state: CwaResourcesStateInterface
  let getterFns: CwaResourcesGettersInterface

  beforeEach(() => {
    state = createState()
    getterFns = getters(state)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  test('Returns the result of utils resourcesApiStateIsPending with current ids', () => {
    const fn = getterFns.resourcesApiStateIsPending.value
    const spy = ResourcesGetterUtils.mock.results[0].value.resourcesApiStateIsPending
    expect(spy).not.toHaveBeenCalled()
    const result = fn(['resource'])
    expect(result).toBe(ResourcesGetterUtils.mock.results[0].value.resourcesApiStateIsPending.mock.results[0].value)
    expect(spy).toHaveBeenCalledTimes(1)
  })
})

describe('ResourcesStore Getters -> isFetchStatusResourcesResolved', () => {
  let state: CwaResourcesStateInterface
  let getterFns: CwaResourcesGettersInterface

  beforeEach(() => {
    state = createState()
    getterFns = getters(state)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  test('If the primary fetch path resource does not exist, return false', () => {
    const currentFetch: FetchStatus = {
      path: '/does-not-exist',
      isPrimary: false,
      resources: [],
    }
    state.current.byId = {}
    expect(getterFns.isFetchStatusResourcesResolved.value(currentFetch)).toBe(false)
  })

  test('If the primary fetch path resource is in an error state, return false', () => {
    const currentFetch: FetchStatus = {
      path: '/errored-resource',
      isPrimary: false,
      resources: ['/success-resource', '/not-found-resource'],
    }
    state.current.byId = {
      '/errored-resource': {
        apiState: {
          status: CwaResourceApiStatuses.ERROR,
          error: {
            statusCode: 500,
          },
          headers: {
            path: '/success-resource',
          },
        },
        data: {
          '@type': CwaResourceTypes.COMPONENT,
        },
      },
    }
    expect(getterFns.isFetchStatusResourcesResolved.value(currentFetch)).toBe(false)
  })

  test('Return true if the resource does not exist in the resources store', () => {
    const currentFetch: FetchStatus = {
      path: '/success-resource',
      isPrimary: true,
      resources: ['does-not-exist'],
    }
    state.current.byId = {
      '/success-resource': {
        apiState: {
          status: CwaResourceApiStatuses.SUCCESS,
          headers: {
            path: '/success-resource',
          },
        },
        data: {
          '@type': CwaResourceTypes.COMPONENT,
        },
      },
    }
    expect(getterFns.isFetchStatusResourcesResolved.value(currentFetch)).toEqual(true)
  })

  test('Returns false if a resource in the fetch chain is-errored', () => {
    const currentFetch: FetchStatus = {
      path: '/success-resource',
      isPrimary: false,
      resources: ['/success-resource', '/errored-resource'],
    }
    state.current.byId = {
      '/success-resource': {
        apiState: {
          status: CwaResourceApiStatuses.SUCCESS,
          headers: {
            path: '/success-resource',
          },
        },
        data: {
          '@type': CwaResourceTypes.COMPONENT,
        },
      },
      '/errored-resource': {
        apiState: {
          status: CwaResourceApiStatuses.ERROR,
          error: {
            statusCode: 500,
          },
          headers: {
            path: '/success-resource',
          },
        },
        data: {
          '@type': CwaResourceTypes.COMPONENT,
        },
      },
    }
    expect(getterFns.isFetchStatusResourcesResolved.value(currentFetch)).toBe(false)
  })

  test('Returns true if a resource in the fetch chain is-errored with non-critical', () => {
    const currentFetch: FetchStatus = {
      path: '/success-resource',
      isPrimary: false,
      resources: ['/success-resource', '/not-found-resource'],
    }
    state.current.byId = {
      '/success-resource': {
        apiState: {
          status: CwaResourceApiStatuses.SUCCESS,
          headers: {
            path: '/success-resource',
          },
        },
        data: {
          '@type': CwaResourceTypes.COMPONENT,
        },
      },
      '/not-found-resource': {
        apiState: {
          status: CwaResourceApiStatuses.ERROR,
          error: {
            statusCode: 404,
          },
          headers: {
            path: '/success-resource',
          },
        },
        data: {
          '@type': CwaResourceTypes.COMPONENT,
        },
      },
    }
    expect(getterFns.isFetchStatusResourcesResolved.value(currentFetch)).toBe(true)
  })

  test('Returns true if a resource in the fetch chain has a different path but is not a component position', () => {
    state.current.byId = {
      '/success-resource': {
        apiState: {
          status: CwaResourceApiStatuses.SUCCESS,
          headers: {
            path: '/success-resource',
          },
        },
        data: {
          '@type': CwaResourceTypes.COMPONENT,
        },
      },
      '/component-different-path': {
        apiState: {
          status: CwaResourceApiStatuses.SUCCESS,
          headers: {
            path: '/another-path',
          },
        },
        data: {
          '@type': CwaResourceTypes.COMPONENT,
        },
      },
    }
    const currentFetch: FetchStatus = {
      path: '/success-resource',
      isPrimary: false,
      resources: ['/success-resource', '/component-different-path'],
    }
    expect(getterFns.isFetchStatusResourcesResolved.value(currentFetch)).toBe(true)
  })

  test('Returns false if a resource in the fetch chain has a different path and is a component position', () => {
    const currentFetch: FetchStatus = {
      path: '/success-resource',
      isPrimary: false,
      resources: ['/success-resource', '/component-position-different-path'],
    }
    state.current.byId = {
      '/success-resource': {
        apiState: {
          status: CwaResourceApiStatuses.SUCCESS,
          headers: {
            path: '/success-resource',
          },
        },
        data: {
          '@type': CwaResourceTypes.COMPONENT,
        },
      },
      '/component-position-different-path': {
        apiState: {
          status: CwaResourceApiStatuses.SUCCESS,
          headers: {
            path: '/another-path',
          },
        },
        data: {
          '@type': CwaResourceTypes.COMPONENT_POSITION,
        },
      },
    }
    expect(getterFns.isFetchStatusResourcesResolved.value(currentFetch)).toBe(false)
  })

  test.each([
    { path: '/not-found-resource', resources: ['/success-resource', '/not-found-resource'], result: false },
    { path: '/does-not-exist', resources: ['/success-resource', '/not-found-resource'], result: false },
    { path: '/success-resource', resources: ['/success-resource', '/not-found-resource'], result: true },
    { path: '/success-resource', resources: ['/success-resource', '/not-found-resource', '/errored-resource'], result: false },
    { path: '/success-resource', resources: ['/success-resource', '/not-found-resource', '/in-progress-resource'], result: true },
    { path: '/success-resource', resources: ['/success-resource', '/not-found-resource', '/in-progress-resource-no-data'], result: false },
  ])('If we only want successful fetch chains, we check the main path. If the main path is $path with the resources $resources the result should be $result', ({
    path,
    resources,
    result,
  }) => {
    const currentFetch: FetchStatus = {
      path,
      isPrimary: false,
      resources,
    }
    state.current.byId = {
      '/success-resource': {
        apiState: {
          status: CwaResourceApiStatuses.SUCCESS,
          headers: {
            path: '/success-resource',
          },
        },
        data: {
          '@type': CwaResourceTypes.COMPONENT,
        },
      },
      '/not-found-resource': {
        apiState: {
          status: CwaResourceApiStatuses.ERROR,
          error: {
            statusCode: 404,
          },
          headers: {
            path: '/success-resource',
          },
        },
        data: {
          '@type': CwaResourceTypes.COMPONENT,
        },
      },
      '/errored-resource': {
        apiState: {
          status: CwaResourceApiStatuses.ERROR,
          error: {
            statusCode: 500,
          },
          headers: {
            path: '/success-resource',
          },
        },
        data: {
          '@type': CwaResourceTypes.COMPONENT,
        },
      },
      '/in-progress-resource': {
        apiState: {
          status: CwaResourceApiStatuses.IN_PROGRESS,
          headers: {
            path: '/success-resource',
          },
        },
        data: {
          '@type': CwaResourceTypes.COMPONENT,
        },
      },
      '/in-progress-resource-no-data': {
        apiState: {
          status: CwaResourceApiStatuses.IN_PROGRESS,
        },
      },
    }
    expect(getterFns.isFetchStatusResourcesResolved.value(currentFetch)).toBe(result)
  })
})

describe('ResourcesStore Getters -> getChildIris', () => {
  let resourcesState: CwaResourcesStateInterface

  beforeEach(() => {
    resourcesState = createState()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  function addResource(iri: string, data: Record<string, any>) {
    resourcesState.current.byId[iri] = {
      apiState: { status: CwaResourceApiStatuses.SUCCESS },
      data,
    } as any
  }

  test('parentPage IRI on a PAGE resource is not included in child IRIs', () => {
    addResource('/_/pages/child-page', {
      '@id': '/_/pages/child-page',
      'parentPage': '/_/pages/parent-page',
    })
    const getterFns = getters(resourcesState)
    const result = getterFns.getChildIris.value('/_/pages/child-page', undefined)
    expect(result).not.toContain('/_/pages/parent-page')
  })

  test('parentPageData IRI on a PAGE_DATA resource is not included in child IRIs', () => {
    addResource('/page_data/child', {
      '@id': '/page_data/child',
      'parentPageData': '/page_data/parent',
    })
    const getterFns = getters(resourcesState)
    const result = getterFns.getChildIris.value('/page_data/child', undefined)
    expect(result).not.toContain('/page_data/parent')
  })

  test.todo('A flat array of children is returned recursively', () => {
    const { instance, $cwa } = createManageableResource()
    const getResource = vi.fn((iri: string) => {
      return computed(() => {
        let obj = { '@id': iri }
        if (iri === '/group') {
          obj = {
            ...obj,
            componentPositions: ['/position-1', '/position-2', '/position-3'],
          }
        }
        if (iri === '/position-1') {
          obj = {
            ...obj,
          }
        }
        if (iri === '/position-2') {
          obj = {
            ...obj,
            component: '/component',
          }
        }
        if (iri === '/position-3') {
          obj = {
            ...obj,
            component: '/no-type',
          }
        }
        if (iri === '/no-type') {
          obj = {
            ...obj,
            component: '/whatever',
          }
        }
        return {
          data: obj,
        }
      })
    })

    vi.spyOn($cwa, 'resources', 'get').mockImplementation(() => {
      return {
        getResource,
      }
    })
    vi.spyOn(ResourceUtils, 'getResourceTypeFromIri').mockImplementation((iri) => {
      if (iri === '/no-type') {
        return undefined
      }
      if (iri === '/component') {
        return CwaResourceTypes.COMPONENT
      }
      return iri.startsWith('/position') ? CwaResourceTypes.COMPONENT_POSITION : CwaResourceTypes.COMPONENT_GROUP
    })

    instance.currentIri = ref('/group')
    expect(instance.childIris.value).toEqual(['/group_placeholder', '/position-1', '/position-1_placeholder', '/position-2', '/position-2_placeholder', '/component', '/position-3', '/position-3_placeholder', '/no-type'])
  })
})

describe('ResourcesStore Getters -> resourceLoadStatus', () => {
  let state: CwaResourcesStateInterface
  let getterFns: CwaResourcesGettersInterface

  beforeEach(() => {
    state = createState()
    getterFns = getters(state)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  test.each([
    { total: 0, complete: 0, expectedPercent: 100 },
    { total: 1, complete: 0, expectedPercent: 0 },
    { total: 2, complete: 1, expectedPercent: 50 },
    { total: 3, complete: 1, expectedPercent: 33 },
    { total: 3, complete: 3, expectedPercent: 100 },
  ])('If the total to fetch is $total and we have loaded $complete the percentage should be $expectedPercent', ({ total, complete, expectedPercent }) => {
    const pending = total - complete
    vi.spyOn(ResourcesGetterUtils.mock.results[0].value, 'totalResourcesPending', 'get').mockImplementationOnce(() => {
      return pending
    })
    const currentIds = Array.from(Array(total).keys())
    state.current = reactive({
      allIds: currentIds,
      currentIds,
      byId: {},
    })
    for (const id of currentIds) {
      state.current.byId[id] = {
        apiState: {
          status: id < complete ? CwaResourceApiStatuses.SUCCESS : CwaResourceApiStatuses.IN_PROGRESS,
        },
      }
    }
    expect(getterFns.resourceLoadStatus.value).toStrictEqual({
      complete,
      pending,
      percent: expectedPercent,
      total,
    })
  })
})

describe('ResourcesStore Getters -> findPublishedComponentIri', () => {
  const publishedIri = '/component/heroes/published'
  const draftIri = '/component/heroes/draft'
  const neverPublishedDraftIri = '/component/heroes/never-published'
  const pageIri = '/_/pages/page'
  const layoutIri = '/_/layouts/layout'
  let state: CwaResourcesStateInterface
  let getterFns: CwaResourcesGettersInterface

  function createResource(iri: string, published?: boolean) {
    return {
      data: {
        '@id': iri,
        ...(published === undefined ? {} : { _metadata: { publishable: { published } } }),
      },
      apiState: { status: CwaResourceApiStatuses.SUCCESS },
    }
  }

  beforeEach(() => {
    state = createState()
    state.current.publishableMapping = [{ publishedIri, draftIri }]
    state.current.byId[publishedIri] = createResource(publishedIri, true)
    state.current.byId[draftIri] = createResource(draftIri, false)
    state.current.byId[neverPublishedDraftIri] = createResource(neverPublishedDraftIri, false)
    state.current.byId[pageIri] = createResource(pageIri)
    state.current.byId[layoutIri] = createResource(layoutIri)
    getterFns = getters(state)
  })

  test('returns a page iri unchanged', () => {
    expect(getterFns.findPublishedComponentIri.value(pageIri)).toBe(pageIri)
  })

  test('returns a layout iri unchanged', () => {
    expect(getterFns.findPublishedComponentIri.value(layoutIri)).toBe(layoutIri)
  })

  test('returns a published component iri unchanged', () => {
    expect(getterFns.findPublishedComponentIri.value(publishedIri)).toBe(publishedIri)
  })

  test('returns the published iri for a draft that has a published version', () => {
    expect(getterFns.findPublishedComponentIri.value(draftIri)).toBe(publishedIri)
  })

  test('returns undefined for a draft that has never been published', () => {
    expect(getterFns.findPublishedComponentIri.value(neverPublishedDraftIri)).toBeUndefined()
  })

  test('returns the published iri for a draft that is mapped before its published version is in the store', () => {
    delete state.current.byId[publishedIri]
    expect(getterFns.findPublishedComponentIri.value(draftIri)).toBe(publishedIri)
  })

  test('returns undefined for an iri that is not in the store', () => {
    expect(getterFns.findPublishedComponentIri.value('/component/heroes/missing')).toBeUndefined()
  })

  test('follows a publishable mapping added after the getter is created', () => {
    const newDraftIri = '/component/heroes/new-draft'
    state.current.byId[newDraftIri] = createResource(newDraftIri, false)
    expect(getterFns.findPublishedComponentIri.value(newDraftIri)).toBeUndefined()
    state.current.publishableMapping.push({ publishedIri, draftIri: newDraftIri })
    expect(getterFns.findPublishedComponentIri.value(newDraftIri)).toBe(publishedIri)
  })
})

describe('ResourcesStore Getters -> componentGroupByReference (#259)', () => {
  const groupA = '/_/component_groups/a'
  const groupB = '/_/component_groups/b'
  let state: CwaResourcesStateInterface
  let getterFns: CwaResourcesGettersInterface
  let storeActions: CwaResourcesActionsInterface

  function group(iri: string, reference: string) {
    return { '@id': iri, '@type': 'ComponentGroup', reference, 'componentPositions': [], '_metadata': { persisted: true } }
  }

  function lookup(reference: string) {
    return getterFns.componentGroupByReference.value(reference)
  }

  beforeEach(() => {
    state = createResourcesState()
    getterFns = getters(state)
    storeActions = actions(state, getterFns)
  })

  test('a group is found by its reference after it is saved', () => {
    expect(lookup('ref-a')).toBeUndefined()
    storeActions.saveResource({ resource: group(groupA, 'ref-a') })
    expect(lookup('ref-a')).toBe(state.current.byId[groupA])
    expect(lookup('ref-a')?.data?.reference).toBe('ref-a')
  })

  test('a group is no longer found by its old reference after its reference changes', () => {
    storeActions.saveResource({ resource: group(groupA, 'old') })
    storeActions.saveResource({ resource: group(groupA, 'new') })
    expect(lookup('old')).toBeUndefined()
    expect(lookup('new')).toBe(state.current.byId[groupA])
  })

  test.each([
    ['deleted', () => storeActions.deleteResource({ resource: groupA })],
    ['evicted', () => storeActions.evictResources([groupA])],
    ['cleared', () => storeActions.clearResources()],
  ])('a group is no longer found by reference after it is %s', (_, remove) => {
    storeActions.saveResource({ resource: group(groupA, 'ref-a') })
    remove()
    expect(lookup('ref-a')).toBeUndefined()
  })

  test('saving a group does not re-run a lookup for a different reference', () => {
    storeActions.saveResource({ resource: group(groupA, 'ref-a') })
    storeActions.saveResource({ resource: group(groupB, 'ref-b') })
    let runs = 0
    const lookupB = computed(() => {
      runs++
      return lookup('ref-b')
    })
    expect(lookupB.value?.data?.['@id']).toBe(groupB)
    storeActions.saveResource({ resource: { ...group(groupA, 'ref-a'), componentPositions: ['/_/component_positions/p'] } })
    storeActions.saveResource({ resource: group('/_/component_groups/c', 'ref-c') })
    expect(lookupB.value?.data?.['@id']).toBe(groupB)
    expect(runs).toBe(1)
  })

  test('the first listed group wins when two share a reference, and the next is found once it is removed', () => {
    storeActions.setResourceFetchStatus({ iri: groupB, isComplete: false, path: groupB })
    storeActions.saveResource({ resource: group(groupA, 'shared') })
    expect(lookup('shared')).toBe(state.current.byId[groupA])
    storeActions.saveResource({ resource: group(groupB, 'shared') })
    expect(state.current.componentGroupIds).toEqual([groupB, groupA])
    expect(lookup('shared')).toBe(state.current.byId[groupB])
    storeActions.deleteResource({ resource: groupB })
    expect(lookup('shared')).toBe(state.current.byId[groupA])
  })

  test('a group merged from new resources is found by its reference', () => {
    storeActions.saveResource({ resource: group(groupA, 'old') })
    storeActions.saveResource({ resource: group(groupA, 'merged'), isNew: true, path: '/' })
    storeActions.mergeNewResources()
    expect(lookup('old')).toBeUndefined()
    expect(lookup('merged')).toBe(state.current.byId[groupA])
  })

  test('a group is found by its reference after the store is hydrated', () => {
    setActivePinia(createPinia())
    const server = new ResourcesStore('ssr').useStore()
    server.saveResource({ resource: group(groupA, 'ref-a') })
    const payload = JSON.parse(JSON.stringify(server.$state))

    const pinia = createPinia()
    pinia.state.value['client.resources'] = payload
    setActivePinia(pinia)
    const client = new ResourcesStore('client').useStore()
    expect(client.componentGroupByReference('ref-a')?.data?.['@id']).toBe(groupA)
  })
})
