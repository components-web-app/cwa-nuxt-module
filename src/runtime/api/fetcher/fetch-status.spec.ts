import { describe, vi, test, expect, beforeEach, beforeAll } from 'vitest'
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { CwaFetcherStoreInterface, FetcherStore } from '../../storage/stores/fetcher/fetcher-store'
import { ResourcesStore } from '../../storage/stores/resources/resources-store'
import { fetcherInitTypes } from '../../storage/stores/fetcher/actions'
import FetchStatus from './fetch-status'

vi.mock('uuid', () => {
  return {
    v4: vi.fn(() => ('my-token'))
  }
})

function delay (time: number, returnValue: any = undefined) {
  return new Promise((resolve) => {
    setTimeout(() => { resolve(returnValue) }, time)
  })
}

let fetcherStoreDefinition: FetcherStore
function createFetchStatus (): FetchStatus {
  const resourcesStore = new ResourcesStore('storeName')
  fetcherStoreDefinition = new FetcherStore('storeName', resourcesStore)
  return new FetchStatus(fetcherStoreDefinition)
}

describe('FetchStatus getters functionality', () => {
  beforeAll(() => {
    const pinia = createTestingPinia({
      createSpy: vi.fn,
      initialState: {
        'storeName.fetcher': {
          status: {
            fetched: {},
            fetch: {}
          }
        }
      }
    })
    setActivePinia(pinia)
  })

  test('Test path getter', () => {
    const fetchStatus = createFetchStatus()
    const fetcherStore = fetcherStoreDefinition.useStore()

    expect(fetchStatus.path).toBe(undefined)

    const fetchedObj = { path: 'fetched-path' }
    fetcherStore.$state.status.fetched = fetchedObj
    expect(fetchStatus.path).toBe('fetched-path')

    fetchedObj.path = 'fetch-path'
    expect(fetchStatus.path).toBe('fetch-path')
  })

  test('Test add and get path promises', () => {
    const fetchStatus = createFetchStatus()
    // @ts-ignore
    fetchStatus.addPath('existing-endpoint', 'some-promise')

    expect(fetchStatus.getFetchingPathPromise('existing-endpoint')).toBe('some-promise')

    expect(fetchStatus.getFetchingPathPromise('non-existent-endpoint')).toBeNull()
  })
})

describe('FetchStatus::setFetchManifestStatus', () => {
  test('We call the fetcher store and return its value', () => {
    const fetchStatus = createFetchStatus()
    const fetcherStore = fetcherStoreDefinition.useStore()
    fetcherStore.setFetchManifestStatus.mockImplementation(() => true)
    const event = {
      path: 'my-path',
      inProgress: true
    }
    expect(fetchStatus.setFetchManifestStatus(event)).toBeTruthy()
    expect(fetcherStore.setFetchManifestStatus).toBeCalledWith(event)
  })
})

describe('FetchStatus::startFetch', () => {
  const fetchStatus = createFetchStatus()
  let fetcherStore: CwaFetcherStoreInterface

  beforeEach(() => {
    const pinia = createTestingPinia({
      createSpy: vi.fn
    })
    setActivePinia(pinia)
    vi.clearAllMocks()
    fetcherStore = fetcherStoreDefinition.useStore()
  })

  test('Test startFetch function', () => {
    // @ts-ignore
    fetcherStore.initFetchStatus.mockImplementation(() => true)

    const startFetchToken = fetchStatus.startFetch({ path: 'start-path' })
    expect(fetcherStore.initFetchStatus).toHaveBeenCalledWith({
      path: 'start-path',
      type: fetcherInitTypes.START,
      token: 'my-token'
    })
    expect(startFetchToken).toStrictEqual({
      startFetchToken: {
        startEvent: {
          path: 'start-path'
        },
        token: 'my-token'
      },
      continueFetching: true
    })
  })

  test('Test startFetch if in existing fetch in progress without an existing fetch path', () => {
    // @ts-ignore
    fetcherStore.initFetchStatus.mockImplementation(() => 'init-fetch-response')

    // @ts-ignore
    fetcherStore.$patch({
      status: {
        fetch: {
          path: 'fetching-path'
        }
      }
    })

    // @ts-ignore
    fetchStatus.addPath('existing-path', 'some-promise')

    const startEvent = { path: 'any-path', resetCurrentResources: true }
    const startFetchToken = fetchStatus.startFetch(startEvent)
    expect(fetcherStore.initFetchStatus).toHaveBeenCalledWith({
      ...startEvent,
      type: fetcherInitTypes.START,
      token: 'my-token'
    })
    expect(startFetchToken).toStrictEqual({
      startFetchToken: {
        startEvent,
        token: 'my-token'
      },
      continueFetching: 'init-fetch-response'
    })
  })

  test('Test startFetch if in progress where existing fetch path exists', () => {
    // @ts-ignore
    fetcherStore.$patch({
      status: {
        fetch: {
          path: 'fetching-path'
        }
      }
    })

    // @ts-ignore
    fetchStatus.addPath('existing-endpoint', 'some-promise')

    const startEvent = { path: 'existing-endpoint' }

    expect(fetchStatus.startFetch(startEvent)).toStrictEqual({
      startFetchToken: {
        startEvent,
        token: 'my-token',
        existingFetchPromise: 'some-promise'
      },
      continueFetching: false
    })

    expect(fetcherStore.initFetchStatus).not.toHaveBeenCalled()
  })
})

describe('FetchStatus::finishFetch', () => {
  let fetchStatus: FetchStatus
  let fetcherStore: CwaFetcherStoreInterface

  beforeEach(() => {
    const pinia = createTestingPinia({
      createSpy: vi.fn
    })
    setActivePinia(pinia)

    fetchStatus = createFetchStatus()
    fetcherStore = fetcherStoreDefinition.useStore()

    // @ts-ignore
    fetcherStore.$patch({
      status: {
        fetch: {
          path: 'fetching-path'
        }
      }
    })

    // @ts-ignore
    fetchStatus.addPath('existing-endpoint', 'some-promise')
  })

  test('Test finishFetch paths are cleared if init status is successful', async () => {
    expect(fetchStatus.getFetchingPathPromise('existing-endpoint')).toBe('some-promise')

    // @ts-ignore
    fetcherStore.initFetchStatus.mockImplementation(() => true)

    const finishFetchObj = {
      token: 'anything',
      pageIri: 'iri',
      fetchSuccess: true
    }
    const finishFetchResult = await fetchStatus.finishFetch(finishFetchObj)
    expect(finishFetchResult).toBeTruthy()
    expect(fetcherStore.initFetchStatus).toHaveBeenCalledWith({
      ...finishFetchObj,
      type: fetcherInitTypes.FINISH
    })

    expect(fetchStatus.getFetchingPathPromise('existing-endpoint')).toBeNull()
  })

  test('Test finishFetch paths are NOT cleared if status is NOT successful', async () => {
    expect(fetchStatus.getFetchingPathPromise('existing-endpoint')).toBe('some-promise')
    // @ts-ignore
    fetcherStore.initFetchStatus.mockImplementation(() => false)

    const finishFetchObj = {
      token: 'anything',
      fetchSuccess: false
    }
    const finishFetchResult = await fetchStatus.finishFetch(finishFetchObj)
    expect(finishFetchResult).toBeFalsy()
    expect(fetcherStore.initFetchStatus).toHaveBeenCalledWith({
      ...finishFetchObj,
      type: fetcherInitTypes.FINISH
    })

    expect(fetchStatus.getFetchingPathPromise('existing-endpoint')).toBe('some-promise')
  })

  test('finish fetch should only resolve when no manifests are fetching', async () => {
    fetcherStore.$patch({
      manifests: {
        somePath: {
          inProgress: true
        }
      }
    })

    // @ts-ignore
    fetcherStore.initFetchStatus.mockImplementation(() => true)
    const finishFetchObj = {
      token: 'anything',
      fetchSuccess: false
    }
    let returned: boolean|undefined
    fetchStatus.finishFetch(finishFetchObj).then((resolvedValue: boolean) => {
      returned = resolvedValue
    })
    await delay(1)
    expect(returned).toBeUndefined()

    fetcherStore.$patch({
      manifests: {
        somePath: {
          inProgress: false
        }
      }
    })
    await delay(1)
    expect(returned).toBeTruthy()
  })
})
