// @vitest-environment happy-dom

import * as vue from 'vue'
import { afterEach, beforeEach, describe, vi, test, expect } from 'vitest'
import { Headers } from 'ofetch'
import { storeToRefs } from 'pinia'
import { computed, reactive } from 'vue'
import { consola as logger } from 'consola'
import Mercure from '../mercure'
import ApiDocumentation from '../api-documentation'
import { FetcherStore } from '../../storage/stores/fetcher/fetcher-store'
import { ResourcesStore } from '../../storage/stores/resources/resources-store'
import type {
  ManifestErrorFetchEvent,
  ManifestSuccessFetchEvent,
  StartFetchEvent,
} from '../../storage/stores/fetcher/actions'
import {
  FinishFetchManifestType,
} from '../../storage/stores/fetcher/actions'
import { createCwaResourceError } from '../../errors/cwa-resource-error'
import type { CwaCurrentResourceInterface } from '../../storage/stores/resources/state'
import { CwaResourceApiStatuses } from '../../storage/stores/resources/state'
import FetchStatusManager from './fetch-status-manager'

vi.mock('../../storage/stores/fetcher/fetcher-store', () => {
  return {
    FetcherStore: vi.fn(function () {
      return {
        useStore: vi.fn(() => {
        }),
      }
    }),
  }
})
vi.mock('../../storage/stores/resources/resources-store', () => {
  return {
    ResourcesStore: vi.fn(function () {
      return {
        useStore: vi.fn(() => {
        }),
      }
    }),
  }
})
vi.mock('../mercure')
vi.mock('../api-documentation')
vi.mock('vue', async () => {
  const actual = await vi.importActual<{ watch: typeof vue.watch, watchEffect: typeof vue.watchEffect, computed: typeof vue.computed }>('vue')
  return {
    ...actual,
    watch: vi.fn((prop, fn, ops) => {
      const stopWatch = actual.watch(prop, fn, ops)
      return vi.fn(() => stopWatch)
    }),
    watchEffect: vi.fn((prop, fn) => {
      const stopWatch = actual.watchEffect(prop, fn)
      return vi.fn(() => stopWatch)
    }),
    computed: vi.fn(fn => actual.computed(fn)),
  }
})
vi.mock('pinia', async (importOriginal) => {
  const { createPinia } = await importOriginal<typeof import('pinia')>()
  return {
    createPinia,
    storeToRefs: vi.fn(),
  }
})

vi.mock('consola')

function createFetchStatusManager(): FetchStatusManager {
  const fetcherUseStoreResult = {
    isCurrentFetchingToken: vi.fn(() => true),
    fetches: {},
    primaryFetch: {},
    setDisplayedToken: vi.fn(),
    routeCache: new Map(),
  }
  const resourcesUseStoreResult = {
    saveResource: vi.fn(),
    setResourceFetchStatus: vi.fn(),
    setResourceFetchError: vi.fn(),
    resetCurrentResources: vi.fn(),
    current: {
      byId: {
        '/success-resource': {
          apiState: {
            status: CwaResourceApiStatuses.SUCCESS,
          },
        },
      },
    },
  }

  const fetcherStore = new FetcherStore()
  vi.spyOn(fetcherStore, 'useStore').mockImplementation(() => {
    return fetcherUseStoreResult
  })
  const resourcesStore = new ResourcesStore()
  vi.spyOn(resourcesStore, 'useStore').mockImplementation(() => {
    return resourcesUseStoreResult
  })
  const mercure = new Mercure()
  const apiDocumentation = new ApiDocumentation()
  return new FetchStatusManager(fetcherStore, mercure, apiDocumentation, resourcesStore)
}

const mockCwaResource = {
  '@id': '/another-resource',
  '@type': 'AnotherResourceType',
  '_metadata': {
    persisted: true,
  },
}

describe('FetchStatusManager -> getFetchedCurrentResource', () => {
  let fetchStatusManager: FetchStatusManager
  let currentResource: CwaCurrentResourceInterface

  beforeEach(() => {
    currentResource = reactive({
      apiState: {
        status: CwaResourceApiStatuses.IN_PROGRESS,
      },
      data: {
        '@id': '/original-resource',
      },
    })
    fetchStatusManager = createFetchStatusManager()
    storeToRefs.mockImplementation(() => {
      return {
        current: {
          value: {
            byId: reactive({
              '/some-resource': currentResource,
            }),
          },
        },
      }
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  test('If the resource does not exist, return undefined', async () => {
    const result = await fetchStatusManager.getFetchedCurrentResource('anything')
    expect(result).toBeUndefined()
  })

  test('If the resource exists we return the updated resource when API state is OK', async () => {
    const promise = fetchStatusManager.getFetchedCurrentResource('/some-resource')

    expect(vue.watchEffect.mock.calls[0][0]).toBeTypeOf('function')
    expect(vue.watchEffect.mock.results[0].value).not.toHaveBeenCalled()

    currentResource.data = {
      '@id': '/resolved-id',
    }
    currentResource.apiState = {
      status: CwaResourceApiStatuses.SUCCESS,
    }

    const result = await promise

    expect(vue.watchEffect.mock.results[0].value).toHaveBeenCalledTimes(1)
    expect(result).toStrictEqual({
      '@id': '/resolved-id',
    })
  })

  test('If API state does not resolve within specified timeout, return the current resource data and log to console', async () => {
    const promise = fetchStatusManager.getFetchedCurrentResource('/some-resource', 5)
    const result = await promise
    expect(vue.watchEffect.mock.results[0].value).toHaveBeenCalledTimes(1)
    expect(result).toStrictEqual({
      '@id': '/original-resource',
    })
    expect(logger.warn).toHaveBeenCalledWith('Timed out 5ms waiting to fetch current resource \'/some-resource\' in pending API state.')
  })
})

describe('FetchStatusManager -> startFetch (Start a new fetch chain)', () => {
  let fetchStatusManager: FetchStatusManager

  beforeEach(() => {
    fetchStatusManager = createFetchStatusManager()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  test('the startFetch action in fetcher store is called the response returned', () => {
    const startFetchResponse = {
      continue: false,
      resources: [],
      token: 'any',
    }
    fetchStatusManager._fetcherStore = {
      startFetch: vi.fn(() => (startFetchResponse)),
    }
    vi.spyOn(fetchStatusManager, 'isCurrentSuccessResourcesResolved', 'get').mockImplementationOnce(() => {
      return 'customResponse'
    })
    const startFetchEvent: StartFetchEvent = {
      path: '/fetch-path',
    }
    const response = fetchStatusManager.startFetch(startFetchEvent)
    expect(fetchStatusManager._fetcherStore.startFetch).toHaveBeenCalledWith({ ...startFetchEvent, isCurrentSuccessResourcesResolved: 'customResponse' })
    expect(ResourcesStore.mock.results[0].value.useStore).toHaveBeenCalledTimes(1)
    expect(response).toStrictEqual(startFetchResponse)
  })

  test('If the event is a primary fetch, we should reset the current resources to the fetcher store response', () => {
    const startFetchResponse = {
      continue: true,
      resources: ['/some-resource'],
      token: 'any',
    }
    fetchStatusManager._fetcherStore = {
      startFetch: vi.fn(() => (startFetchResponse)),
      primaryFetch: {},
      setDisplayedToken: vi.fn(),
      routeCache: new Map(),
      resetIriDepths: vi.fn(),
    }
    const startFetchEvent: StartFetchEvent = {
      path: '/fetch-path',
      isPrimary: true,
    }
    const response = fetchStatusManager.startFetch(startFetchEvent)
    expect(ResourcesStore.mock.results[0].value.useStore.mock.results[0].value.resetCurrentResources).toBeCalledWith(startFetchResponse.resources)
    expect(Mercure.mock.instances[0].init).not.toHaveBeenCalled()
    expect(response).toStrictEqual(startFetchResponse)
  })
})

describe('FetchStatusManager -> clearPrimaryFetch', () => {
  let fetchStatusManager: FetchStatusManager

  beforeEach(() => {
    fetchStatusManager = createFetchStatusManager()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  test('resets the fetching, success and displayed tokens', () => {
    fetchStatusManager._fetcherStore = {
      primaryFetch: { fetchingToken: 'f', successToken: 's', displayedToken: 'd' },
    }
    fetchStatusManager.clearPrimaryFetch()
    expect(fetchStatusManager._fetcherStore.primaryFetch.fetchingToken).toBeUndefined()
    expect(fetchStatusManager._fetcherStore.primaryFetch.successToken).toBeUndefined()
    expect(fetchStatusManager._fetcherStore.primaryFetch.displayedToken).toBeUndefined()
  })
})

describe('FetchStatusManager -> startFetchResource', () => {
  let fetchStatusManager: FetchStatusManager

  beforeEach(() => {
    fetchStatusManager = createFetchStatusManager()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  test('We call fetcherStore.addFetchResource with the event and return the result', () => {
    fetchStatusManager._fetcherStore = {
      addFetchResource: vi.fn(() => false),
    }

    const startFetchResourceEvent = {
      token: 'my-token',
      resource: '/a-new-resource',
    }
    const result = fetchStatusManager.startFetchResource(startFetchResourceEvent)
    expect(fetchStatusManager._fetcherStore.addFetchResource).toHaveBeenCalledWith(startFetchResourceEvent)
    expect(ResourcesStore.mock.results[0].value.useStore).toHaveBeenCalledTimes(1)
    expect(result).toBe(false)
  })

  test('If fetcherStore.addFetchResource returns, we set the resource fetch status', () => {
    fetchStatusManager._fetcherStore = {
      addFetchResource: vi.fn(() => true),
    }

    const startFetchResourceEvent = {
      token: 'my-token',
      resource: '/a-new-resource',
    }
    const result = fetchStatusManager.startFetchResource(startFetchResourceEvent)
    expect(fetchStatusManager._fetcherStore.addFetchResource).toHaveBeenCalledWith(startFetchResourceEvent)
    expect(ResourcesStore.mock.results[0].value.useStore.mock.results[0].value.setResourceFetchStatus).toHaveBeenCalledWith({
      iri: '/a-new-resource',
      isComplete: false,
    })
    expect(result).toBe(true)
  })
})

describe('FetchStatusManager -> finishFetchShowError', () => {
  let fetchStatusManager: FetchStatusManager

  beforeEach(() => {
    fetchStatusManager = createFetchStatusManager()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  test.each([
    {
      fetchStatus: undefined,
      resource: '',
      expected: false,
    },
    {
      fetchStatus: {
        isPrimary: true,
        path: 'something',
      },
      resource: 'something',
      expected: true,
    },
    {
      fetchStatus: {
        isPrimary: true,
        path: 'something',
      },
      resource: 'different',
      expected: false,
    },
    {
      fetchStatus: {
        isPrimary: false,
        path: 'something',
      },
      resource: 'something',
      expected: false,
    },
  ])('If fetchStatus is $fetchStatus and resource is $resource finishFetchShowError should return $expected', ({ fetchStatus, resource, expected }) => {
    expect(fetchStatusManager.finishFetchShowError(fetchStatus, resource)).toBe(expected)
  })
})

describe('FetchStatusManager -> finishFetchResource', () => {
  let fetchStatusManager: FetchStatusManager

  beforeEach(() => {
    fetchStatusManager = createFetchStatusManager()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  test('If fetching token is for a resource which is already successful we should not proceed', () => {
    const fetcherStore = FetcherStore.mock.results[0].value

    const response = fetchStatusManager.finishFetchResource({
      resource: '/success-resource',
      success: true,
      token: 'my-token',
      fetchResponse: {
        _data: mockCwaResource,
      },
      headers: {},
    })

    expect(fetcherStore.useStore).toHaveBeenCalledTimes(1)
    expect(response).toBeUndefined()
  })

  test('If fetching token is aborted, return undefined without touching the resource store', () => {
    const useStoreImplementation = {
      isCurrentFetchingToken: vi.fn(() => false),
      fetches: {
        'my-token': {
          abort: true,
        },
      },
    }
    fetchStatusManager._fetcherStore = useStoreImplementation

    const response = fetchStatusManager.finishFetchResource({
      resource: '/some-resource',
      success: true,
      token: 'my-token',
      fetchResponse: {
        _data: mockCwaResource,
      },
      headers: {},
    })

    expect(useStoreImplementation.isCurrentFetchingToken).toHaveBeenCalledWith('my-token')
    expect(ResourcesStore.mock.results[0].value.useStore.mock.results[0].value.setResourceFetchError).not.toHaveBeenCalled()
    expect(ResourcesStore.mock.results[0].value.useStore.mock.results[0].value.setResourceFetchStatus).not.toHaveBeenCalled()
    expect(response).toBeUndefined()
  })

  test('If fetching token is not aborted but not current, return undefined without touching the resource store', () => {
    const useStoreImplementation = {
      isCurrentFetchingToken: vi.fn(() => false),
      fetches: {
        'my-token': {},
      },
    }
    fetchStatusManager._fetcherStore = useStoreImplementation

    const response = fetchStatusManager.finishFetchResource({
      resource: '/some-resource',
      success: true,
      token: 'my-token',
      fetchResponse: {
        _data: mockCwaResource,
      },
      headers: {},
    })

    expect(useStoreImplementation.isCurrentFetchingToken).toHaveBeenCalledWith('my-token')
    expect(ResourcesStore.mock.results[0].value.useStore.mock.results[0].value.setResourceFetchError).not.toHaveBeenCalled()
    expect(ResourcesStore.mock.results[0].value.useStore.mock.results[0].value.setResourceFetchStatus).not.toHaveBeenCalled()
    expect(response).toBeUndefined()
  })

  test('If the event passed determines the fetch was not successful, update resource with setResourceFetchError and do not call setResourceFetchStatus', () => {
    const fetcherStore = FetcherStore.mock.results[0].value
    vi.spyOn(fetchStatusManager, 'finishFetchShowError').mockImplementationOnce(() => true)

    const response = fetchStatusManager.finishFetchResource({
      resource: '/another-resource',
      success: false,
      token: 'a-token',
      error: {
        name: 'CwaResourceError',
        statusCode: 100,
        message: 'something',
      },
    })

    expect(fetcherStore.useStore).toHaveBeenCalledTimes(1)
    expect(fetcherStore.useStore.mock.results[0].value.isCurrentFetchingToken).toHaveBeenCalledWith('a-token')
    expect(ResourcesStore.mock.results[0].value.useStore.mock.results[0].value.setResourceFetchError).toHaveBeenCalledWith({
      iri: '/another-resource',
      isCurrent: fetcherStore.useStore.mock.results[0].value.isCurrentFetchingToken.mock.results[0].value,
      error: {
        name: 'CwaResourceError',
        statusCode: 100,
        message: 'something',
      },
      showErrorPage: true,
    })
    expect(ResourcesStore.mock.results[0].value.useStore.mock.results[0].value.setResourceFetchStatus).not.toHaveBeenCalled()

    expect(response).toBeUndefined()
  })

  test('If the event is successful and fetch store has finished the fetch, save the resource and set the resource status', () => {
    const response = fetchStatusManager.finishFetchResource({
      resource: '/another-resource',
      success: true,
      token: 'a-token',
      fetchResponse: {
        _data: mockCwaResource,
        headers: new Headers(),
      },
      headers: {
        path: 'something',
      },
      path: undefined,
    })

    expect(ResourcesStore.mock.results[0].value.useStore.mock.results[0].value.setResourceFetchError).not.toHaveBeenCalled()
    expect(ResourcesStore.mock.results[0].value.useStore.mock.results[0].value.saveResource).toHaveBeenCalledWith({
      resource: mockCwaResource,
    })
    expect(ResourcesStore.mock.results[0].value.useStore.mock.results[0].value.setResourceFetchStatus).toHaveBeenCalledWith({
      iri: '/another-resource',
      isComplete: true,
      headers: {
        path: 'something',
      },
      path: undefined,
      responseIri: '/another-resource',
    })

    expect(Mercure.mock.instances[0].setMercureHubFromLinkHeader).not.toHaveBeenCalled()
    expect(ApiDocumentation.mock.instances[0].setDocsPathFromLinkHeader).not.toHaveBeenCalled()

    expect(response).toStrictEqual(mockCwaResource)
  })

  test('If the event is successful and fetch store has finished the fetch, but noSave is true, do not save the resource', () => {
    const response = fetchStatusManager.finishFetchResource({
      resource: '/another-resource',
      success: true,
      token: 'a-token',
      fetchResponse: {
        _data: mockCwaResource,
        headers: new Headers(),
      },
      headers: {
        path: 'something',
      },
      noSave: true,
    })
    expect(ResourcesStore.mock.results[0].value.useStore.mock.results[0].value.saveResource).not.toHaveBeenCalled()
    expect(response).toStrictEqual(mockCwaResource)
  })

  test('If the response is not a valid resource, set an error message', () => {
    vi.spyOn(fetchStatusManager, 'finishFetchShowError').mockImplementationOnce(() => true)
    const response = fetchStatusManager.finishFetchResource({
      resource: '/another-resource',
      success: true,
      token: 'a-token',
      fetchResponse: {
        _data: { not: 'a valid resource' },
        headers: new Headers(),
      },
      headers: {
        path: 'something',
      },
    })

    expect(ResourcesStore.mock.results[0].value.useStore.mock.results[0].value.setResourceFetchError).toHaveBeenCalledWith({
      iri: '/another-resource',
      error: createCwaResourceError(new Error('Not Saved. The response was not a valid CWA Resource. (/another-resource)')),
      isCurrent: true,
      showErrorPage: true,
    })

    expect(response).toBeUndefined()
  })

  test('If a link header is provided, we call the mercure and api documentation initialise functions', () => {
    const headers = new Headers()
    headers.set('link', 'my-link-header')

    const response = fetchStatusManager.finishFetchResource({
      resource: '/another-resource',
      success: true,
      token: 'a-token',
      fetchResponse: {
        _data: mockCwaResource,
        headers,
      },
      headers: {
        path: 'something',
      },
    })

    expect(Mercure.mock.instances[0].setMercureHubFromLinkHeader).toHaveBeenCalledWith('my-link-header')
    expect(ApiDocumentation.mock.instances[0].setDocsPathFromLinkHeader).toHaveBeenCalledWith('my-link-header')

    expect(response).toStrictEqual(mockCwaResource)
  })
})

describe('FetchStatusManager -> computedFetchChainComplete', () => {
  let fetchStatusManager: FetchStatusManager
  let resourcesStore: ResourcesStore

  beforeEach(() => {
    fetchStatusManager = createFetchStatusManager()
    resourcesStore = ResourcesStore.mock.results[0].value
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  test.each([
    { resolving: true, result: false },
    { resolving: false, abort: true, result: true },
    { resolving: false, abort: false, resources: undefined, result: false },
    { resolving: false, abort: false, resources: [], resourcesApiStateIsPending: false, result: true },
    { resolving: false, abort: false, resources: [], resourcesApiStateIsPending: true, result: false },
  ])('Return $result if resolving is $resolving and abort is $abort and resources are $resources', ({ resolving, abort, resources, resourcesApiStateIsPending, result }) => {
    const isFetchResolving = vi.fn(() => ({
      resolving,
      fetchStatus: {
        abort,
        resources,
      },
    }))
    fetchStatusManager._fetcherStore = {
      isFetchResolving,
    }
    const resourcesApiStateIsPendingFn = vi.fn(() => resourcesApiStateIsPending)
    fetchStatusManager._resourcesStore = {
      resourcesApiStateIsPending: resourcesApiStateIsPendingFn,
    }
    const response = fetchStatusManager.computedFetchChainComplete('my-token')
    const computedValue = response.value
    if (resourcesApiStateIsPending !== undefined) {
      expect(resourcesStore.useStore).toHaveBeenCalledTimes(1)
      expect(resourcesApiStateIsPendingFn).toHaveBeenCalledTimes(1)
      expect(resourcesApiStateIsPendingFn).toHaveBeenCalledWith(resources)
    }
    else {
      expect(resourcesApiStateIsPendingFn).not.toHaveBeenCalled()
    }
    expect(isFetchResolving).toHaveBeenCalledWith('my-token')
    expect(computedValue).toBe(result)
  })
})

describe('FetchStatusManager -> finishFetch (finish a fetch chain)', () => {
  let fetchStatusManager: FetchStatusManager

  beforeEach(() => {
    fetchStatusManager = createFetchStatusManager()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  test('Call the fetcher store action finishFetch with the event and return the result, while waiting for computedFetchChainComplete', async () => {
    const finishFetch = vi.fn(() => Promise.resolve('anything'))
    fetchStatusManager._fetcherStore = {
      finishFetch,
      routeCache: new Map(),
    }
    vi.spyOn(fetchStatusManager, 'computedFetchChainComplete').mockImplementation(() => {
      return computed(() => true)
    })

    const result = await fetchStatusManager.finishFetch({
      token: 'a-token',
    })

    // expect(vue.computed).toHaveBeenCalledTimes(1)
    // expect(vue.computed.mock.calls[0][0]).toBeTypeOf('function')

    expect(vue.watch.mock.calls[0][0]).toBe(fetchStatusManager.computedFetchChainComplete.mock.results[0].value)
    expect(vue.watch.mock.calls[0][1]).toBeTypeOf('function')
    expect(vue.watch.mock.calls[0][2]).toStrictEqual({ immediate: true })
    expect(fetchStatusManager.computedFetchChainComplete).toHaveBeenCalledWith('a-token')

    expect(vue.watch.mock.results[0].value).toHaveBeenCalledTimes(1)

    expect(finishFetch).toHaveBeenCalledWith({ token: 'a-token' })
    expect(finishFetch.mock.invocationCallOrder[0]).toBeGreaterThan(vue.watch.mock.results[0].value.mock.invocationCallOrder[0])
    expect(result).toBeUndefined()
  })
})

describe('FetchStatusManager -> finishManifestFetch', () => {
  let fetchStatusManager: FetchStatusManager

  beforeEach(() => {
    fetchStatusManager = createFetchStatusManager()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  test('Can handle a manifest success event', () => {
    const finishManifestFetch = vi.fn(() => 'anything')
    fetchStatusManager._fetcherStore = {
      finishManifestFetch,
    }
    const successEvent: ManifestSuccessFetchEvent = {
      type: FinishFetchManifestType.SUCCESS,
      token: 'a-token',
      resources: ['/manifest-resource'],
    }
    fetchStatusManager.finishManifestFetch(successEvent)
    expect(finishManifestFetch).toHaveBeenCalledWith(successEvent)
  })

  test('Can handle a manifest error event', () => {
    const finishManifestFetch = vi.fn(() => 'anything')
    fetchStatusManager._fetcherStore = {
      finishManifestFetch,
    }
    const errorEvent: ManifestErrorFetchEvent = {
      type: FinishFetchManifestType.ERROR,
      token: 'a-token',
      error: {
        name: 'CwaResourceError',
        message: 'My manifest error',
      },
    }
    fetchStatusManager.finishManifestFetch(errorEvent)
    expect(finishManifestFetch).toHaveBeenCalledWith(errorEvent)
  })
})

describe('FetchStatusManager -> isCurrentFetchingToken', () => {
  let fetchStatusManager: FetchStatusManager

  beforeEach(() => {
    fetchStatusManager = createFetchStatusManager()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  test('Passed arguments to store and returns store value', () => {
    const isCurrentFetchingToken = vi.fn(() => 'anything')
    fetchStatusManager._fetcherStore = {
      isCurrentFetchingToken,
    }
    const result = fetchStatusManager.isCurrentFetchingToken('my-token')
    expect(isCurrentFetchingToken).toHaveBeenCalledWith('my-token')
    expect(result).toBe('anything')
  })
})

describe('FetchStatusManager -> abortFetch', () => {
  let fetchStatusManager: FetchStatusManager

  beforeEach(() => {
    fetchStatusManager = createFetchStatusManager()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  test('Passed arguments to store action and returns value', () => {
    const abortFetch = vi.fn(() => 'anything')
    fetchStatusManager._fetcherStore = {
      abortFetch,
    }
    const result = fetchStatusManager.abortFetch('my-token')
    expect(abortFetch).toHaveBeenCalledWith({ token: 'my-token', reason: undefined })
    expect(result).toBe('anything')
  })

  test('An abort reason is forwarded to the store action', () => {
    const abortFetch = vi.fn(() => 'anything')
    fetchStatusManager._fetcherStore = {
      abortFetch,
    }
    fetchStatusManager.abortFetch('my-token', 'redirect')
    expect(abortFetch).toHaveBeenCalledWith({ token: 'my-token', reason: 'redirect' })
  })
})

describe('FetchStatusManager -> primaryFetchPath', () => {
  let fetchStatusManager: FetchStatusManager

  beforeEach(() => {
    fetchStatusManager = createFetchStatusManager()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  test('Returns the fetcher store getter result', () => {
    fetchStatusManager._fetcherStore = {
      primaryFetchPath: 'anything',
    }
    expect(fetchStatusManager.primaryFetchPath).toBe('anything')
  })
})

describe('FetchStatusManager -> depth tracking (delegates to the fetcher store)', () => {
  // The depth lookups themselves live in the fetcher store so they survive the SSR->client payload
  // (see `storage/stores/fetcher/actions.spec.ts` for their behaviour, and
  // `nested-page-hydration.spec.ts` for why). The manager's remaining job is to delegate.
  let fetchStatusManager: FetchStatusManager

  const depthNode = (iris: string[]) => ({ iri: iris[0], children: iris.slice(1).map(iri => ({ iri, children: [] })) })

  beforeEach(() => {
    fetchStatusManager = createFetchStatusManager()
    fetchStatusManager._fetcherStore = {
      iriDepths: { '/_/pages/parent': 0 },
      depthPaths: { 0: '/topic-1' },
      setManifestIrisByDepth: vi.fn(),
      registerIriDepth: vi.fn(),
      resetIriDepths: vi.fn(),
      startFetch: vi.fn(() => ({ continue: true, token: 'token', resources: [] })),
      primaryFetch: {},
      setDisplayedToken: vi.fn(),
      routeCache: new Map(),
    }
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  test('getDepthForIri reads the depth from the store', () => {
    expect(fetchStatusManager.getDepthForIri('/_/pages/parent')).toBe(0)
    expect(fetchStatusManager.getDepthForIri('/unknown')).toBeUndefined()
  })

  test('getPathForDepth reads the path from the store', () => {
    expect(fetchStatusManager.getPathForDepth(0)).toBe('/topic-1')
    expect(fetchStatusManager.getPathForDepth(2)).toBeUndefined()
  })

  test('setManifestIrisByDepth passes the event to the store, which derives the depths', () => {
    const event = { token: 'token', resourceIris: [depthNode(['/_/routes//topic-1', '/_/pages/parent'])] }
    fetchStatusManager.setManifestIrisByDepth(event)
    expect(fetchStatusManager._fetcherStore.setManifestIrisByDepth).toHaveBeenCalledWith(event)
  })

  test('registerIriDepth passes the IRI and depth to the store', () => {
    fetchStatusManager.registerIriDepth('/component/some-uuid', 0)
    expect(fetchStatusManager._fetcherStore.registerIriDepth).toHaveBeenCalledWith({ iri: '/component/some-uuid', depth: 0 })
  })

  test('startFetch with isPrimary clears depth tracking', () => {
    fetchStatusManager.startFetch({ path: '/new', isPrimary: true })
    expect(fetchStatusManager._fetcherStore.resetIriDepths).toHaveBeenCalled()
  })

  test('startFetch without isPrimary preserves depth tracking', () => {
    fetchStatusManager.startFetch({ path: '/new', isPrimary: false })
    expect(fetchStatusManager._fetcherStore.resetIriDepths).not.toHaveBeenCalled()
  })
})

describe('FetchStatusManager -> isCurrentSuccessResourcesResolved', () => {
  let fetchStatusManager: FetchStatusManager

  beforeEach(() => {
    fetchStatusManager = createFetchStatusManager()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  test('Returns false is there is no success fetch status', () => {
    fetchStatusManager._fetcherStore = {
      resolvedSuccessFetchStatus: undefined,
    }
    expect(fetchStatusManager.isCurrentSuccessResourcesResolved).toBe(false)
  })

  test('Returns the result of isFetchStatusResourcesResolved called with the fetch status', () => {
    fetchStatusManager._fetcherStore = {
      resolvedSuccessFetchStatus: 'something',
    }
    fetchStatusManager._resourcesStore = {
      isFetchStatusResourcesResolved: vi.fn(() => {
        return true
      }),
    }
    expect(fetchStatusManager.isCurrentSuccessResourcesResolved).toBe(true)
  })
})
