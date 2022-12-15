import * as vue from 'vue'
import { afterEach, beforeEach, describe, vi, test, expect } from 'vitest'
import Mercure from '../mercure'
import ApiDocumentation from '../api-documentation'
import { FetcherStore } from '../../storage/stores/fetcher/fetcher-store'
import { ResourcesStore } from '../../storage/stores/resources/resources-store'
import {
  FinishFetchManifestType,
  ManifestErrorFetchEvent,
  ManifestSuccessFetchEvent,
  StartFetchEvent
} from '../../storage/stores/fetcher/actions'
import FetchStatusManager from './fetch-status-manager'

vi.mock('../../storage/stores/fetcher/fetcher-store', () => ({
  FetcherStore: vi.fn(() => ({
    useStore: vi.fn()
  }))
}))
vi.mock('../../storage/stores/resources/resources-store', () => ({
  ResourcesStore: vi.fn(() => ({
    useStore: vi.fn(() => ({
      setResourceFetchStatus: vi.fn(),
      setResourceFetchError: vi.fn(),
      resetCurrentResources: vi.fn()
    }))
  }))
}))
vi.mock('../mercure')
vi.mock('../api-documentation')
vi.mock('vue', async () => {
  const actual = await vi.importActual<{ watch: typeof vue.watch, computed: typeof vue.computed }>('vue')
  return {
    ...actual,
    watch: vi.fn((prop, fn, ops) => {
      const stopWatch = actual.watch(prop, fn, ops)
      return vi.fn(() => stopWatch)
    }),
    computed: vi.fn(fn => actual.computed(fn))
  }
})

function createFetchStatusManager (): FetchStatusManager {
  const fetcherStore = new FetcherStore()
  const resourcesStore = new ResourcesStore()
  const mercure = new Mercure()
  const apiDocumentation = new ApiDocumentation()
  return new FetchStatusManager(fetcherStore, mercure, apiDocumentation, resourcesStore)
}

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
      token: 'any'
    }
    const fetcherStore = FetcherStore.mock.results[0].value
    vi.spyOn(fetcherStore, 'useStore').mockImplementation(() => {
      return {
        startFetch: vi.fn(() => (startFetchResponse))
      }
    })
    const startFetchEvent: StartFetchEvent = {
      path: '/fetch-path'
    }
    const response = fetchStatusManager.startFetch(startFetchEvent)
    expect(fetcherStore.useStore.mock.results[0].value.startFetch).toHaveBeenCalledWith(startFetchEvent)
    expect(ResourcesStore.mock.results[0].value.useStore).not.toHaveBeenCalled()
    expect(response).toStrictEqual(startFetchResponse)
  })

  test('If the event is a primary fetch, we should reset the current resources to the fetcher store response', () => {
    const fetcherStore = FetcherStore.mock.results[0].value
    const startFetchResponse = {
      continue: true,
      resources: ['/some-resource'],
      token: 'any'
    }
    vi.spyOn(fetcherStore, 'useStore').mockImplementation(() => {
      return {
        startFetch: vi.fn(() => (startFetchResponse))
      }
    })
    const startFetchEvent: StartFetchEvent = {
      path: '/fetch-path',
      isPrimary: true
    }
    const response = fetchStatusManager.startFetch(startFetchEvent)
    expect(ResourcesStore.mock.results[0].value.useStore.mock.results[0].value.resetCurrentResources).toBeCalledWith(startFetchResponse.resources)
    expect(Mercure.mock.instances[0].init).not.toHaveBeenCalled()
    expect(response).toStrictEqual(startFetchResponse)
  })

  // useful for first fetch client-side which we do not need to continue and need to initialise mercure for the first time
  test('If we are not continuing the fetch, re-initialise the mercure store', () => {
    const startFetchResponse = {
      continue: false,
      resources: [],
      token: 'any'
    }
    const fetcherStore = FetcherStore.mock.results[0].value
    vi.spyOn(fetcherStore, 'useStore').mockImplementation(() => {
      return {
        startFetch: vi.fn(() => (startFetchResponse))
      }
    })
    const startFetchEvent: StartFetchEvent = {
      path: '/fetch-path'
    }
    const response = fetchStatusManager.startFetch(startFetchEvent)
    expect(Mercure.mock.instances[0].init).toHaveBeenCalledTimes(1)
    expect(response).toStrictEqual(startFetchResponse)
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
    const fetcherStore = FetcherStore.mock.results[0].value
    vi.spyOn(fetcherStore, 'useStore').mockImplementation(() => {
      return {
        addFetchResource: vi.fn(() => false)
      }
    })

    const startFetchResourceEvent = {
      token: 'my-token',
      resource: '/a-new-resource'
    }
    const result = fetchStatusManager.startFetchResource(startFetchResourceEvent)
    expect(fetcherStore.useStore.mock.results[0].value.addFetchResource).toHaveBeenCalledWith(startFetchResourceEvent)
    expect(ResourcesStore.mock.results[0].value.useStore).not.toHaveBeenCalled()
    expect(result).toBe(false)
  })

  test('If fetcherStore.addFetchResource returns true, we set the resource fetch status', () => {
    const fetcherStore = FetcherStore.mock.results[0].value
    vi.spyOn(fetcherStore, 'useStore').mockImplementation(() => {
      return {
        addFetchResource: vi.fn(() => true)
      }
    })

    const startFetchResourceEvent = {
      token: 'my-token',
      resource: '/a-new-resource'
    }
    const result = fetchStatusManager.startFetchResource(startFetchResourceEvent)
    expect(fetcherStore.useStore.mock.results[0].value.addFetchResource).toHaveBeenCalledWith(startFetchResourceEvent)
    expect(ResourcesStore.mock.results[0].value.useStore.mock.results[0].value.setResourceFetchStatus).toHaveBeenCalledWith({
      iri: '/a-new-resource',
      isComplete: false
    })
    expect(result).toBe(true)
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

  test('If not a current fetching token, update the resources store with an error message once. Do not call setResourceFetchStatus', () => {
    const fetcherStore = FetcherStore.mock.results[0].value
    vi.spyOn(fetcherStore, 'useStore').mockImplementationOnce(() => {
      return {
        isCurrentFetchingToken: vi.fn(() => false)
      }
    })

    fetchStatusManager.finishFetchResource({
      resource: '/some-resource',
      success: true,
      token: 'my-token',
      error: {
        statusCode: 100,
        message: 'something'
      }
    })

    expect(fetcherStore.useStore.mock.results[0].value.isCurrentFetchingToken).toHaveBeenCalledWith('my-token')

    expect(ResourcesStore.mock.results[0].value.useStore.mock.results[0].value.setResourceFetchError).toHaveBeenCalledWith({
      iri: '/some-resource',
      isCurrent: false,
      error: {
        message: "Not Saved. Fetching token 'my-token' is no longer current"
      }
    })
    expect(ResourcesStore.mock.results[0].value.useStore.mock.results[0].value.setResourceFetchStatus).not.toHaveBeenCalled()
  })

  test('If the event passed determines the fetch was not successful, update resource with setResourceFetchError and do not call setResourceFetchStatus', () => {
    const fetcherStore = FetcherStore.mock.results[0].value
    vi.spyOn(fetcherStore, 'useStore').mockImplementationOnce(() => {
      return {
        isCurrentFetchingToken: vi.fn(() => true)
      }
    })

    fetchStatusManager.finishFetchResource({
      resource: '/another-resource',
      success: false,
      token: 'a-token',
      error: {
        statusCode: 100,
        message: 'something'
      }
    })

    expect(ResourcesStore.mock.results[0].value.useStore.mock.results[0].value.setResourceFetchError).toHaveBeenCalledWith({
      iri: '/another-resource',
      isCurrent: true,
      error: {
        statusCode: 100,
        message: 'something'
      }
    })
    expect(ResourcesStore.mock.results[0].value.useStore.mock.results[0].value.setResourceFetchStatus).not.toHaveBeenCalled()
  })
  test('If the event is successful and fetch store has finished the fetch, call setResourceFetchStatus', () => {
    const fetcherStore = FetcherStore.mock.results[0].value
    vi.spyOn(fetcherStore, 'useStore').mockImplementationOnce(() => {
      return {
        isCurrentFetchingToken: vi.fn(() => true)
      }
    })

    fetchStatusManager.finishFetchResource({
      resource: '/another-resource',
      success: true,
      token: 'a-token'
    })

    expect(ResourcesStore.mock.results[0].value.useStore.mock.results[0].value.setResourceFetchError).not.toHaveBeenCalled()
    expect(ResourcesStore.mock.results[0].value.useStore.mock.results[0].value.setResourceFetchStatus).toHaveBeenCalledWith({
      iri: '/another-resource',
      isComplete: true
    })
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

  test('Call the fetcher store action finishFetch with the event and return the result, while waiting for the isFetchChainComplete to be successful', async () => {
    const fetcherStore = FetcherStore.mock.results[0].value
    vi.spyOn(fetcherStore, 'useStore').mockImplementation(() => {
      return {
        finishFetch: vi.fn(() => Promise.resolve('anything')),
        isFetchChainComplete: vi.fn(() => true)
      }
    })

    const result = await fetchStatusManager.finishFetch({
      token: 'a-token'
    })

    expect(vue.computed).toHaveBeenCalledTimes(1)
    expect(vue.computed.mock.calls[0][0]).toBeTypeOf('function')
    expect(vue.watch.mock.calls[0][0]).toBe(vue.computed.mock.results[0].value)
    expect(vue.watch.mock.calls[0][1]).toBeTypeOf('function')
    expect(vue.watch.mock.calls[0][2]).toStrictEqual({ immediate: true })
    expect(fetcherStore.useStore.mock.results[0].value.finishFetch).toHaveBeenCalledWith({ token: 'a-token' })
    expect(fetcherStore.useStore.mock.results[1].value.isFetchChainComplete).toHaveBeenCalledWith('a-token')
    expect(vue.watch.mock.results[0].value).toHaveBeenCalledTimes(1)
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
    const fetcherStore = FetcherStore.mock.results[0].value
    vi.spyOn(fetcherStore, 'useStore').mockImplementationOnce(() => {
      return {
        finishManifestFetch: vi.fn(() => 'anything')
      }
    })
    const successEvent: ManifestSuccessFetchEvent = {
      type: FinishFetchManifestType.SUCCESS,
      token: 'a-token',
      resources: ['/manifest-resource']
    }
    fetchStatusManager.finishManifestFetch(successEvent)
    expect(fetcherStore.useStore.mock.results[0].value.finishManifestFetch).toHaveBeenCalledWith(successEvent)
  })

  test('Can handle a manifest error event', () => {
    const fetcherStore = FetcherStore.mock.results[0].value
    vi.spyOn(fetcherStore, 'useStore').mockImplementationOnce(() => {
      return {
        finishManifestFetch: vi.fn(() => 'anything')
      }
    })
    const errorEvent: ManifestErrorFetchEvent = {
      type: FinishFetchManifestType.ERROR,
      token: 'a-token',
      error: {
        message: 'My manifest error'
      }
    }
    fetchStatusManager.finishManifestFetch(errorEvent)
    expect(fetcherStore.useStore.mock.results[0].value.finishManifestFetch).toHaveBeenCalledWith(errorEvent)
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
    const fetcherStore = FetcherStore.mock.results[0].value
    vi.spyOn(fetcherStore, 'useStore').mockImplementationOnce(() => {
      return {
        primaryFetchPath: 'anything'
      }
    })
    expect(fetchStatusManager.primaryFetchPath).toBe('anything')
  })
})
