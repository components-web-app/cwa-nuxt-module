import { describe, test, vi, beforeEach, expect, beforeAll } from 'vitest'
import { setActivePinia } from 'pinia'
import { consola as logger } from 'consola'
import { createTestingPinia } from '@pinia/testing'
import { flushPromises } from '@vue/test-utils'
import { ApiDocumentationStore } from '../storage/stores/api-documentation/api-documentation-store'
import ApiDocumentation from './api-documentation'
import CwaFetch from './fetcher/cwa-fetch'

vi.mock('consola')

const mockedFetchResponseTime = 2

vi.mock('../storage/stores/api-documentation/state')
vi.mock('./fetcher/cwa-fetch', () => {
  return {
    default: vi.fn(() => ({
      fetch: vi.fn(async (path) => {
        await new Promise((resolve) => {
          setTimeout(resolve, 2)
        })
        return 'response from ' + path
      }),
    })),
  }
})

let apiDocumentationStore: ApiDocumentationStore
const cwaFetchInstance = new CwaFetch('https://dummy-api-url')
function createApiDocumentation(): ApiDocumentation {
  apiDocumentationStore = new ApiDocumentationStore('storeName')
  return new ApiDocumentation(cwaFetchInstance, apiDocumentationStore)
}

function delay(time: number, returnValue: any = undefined) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(returnValue)
    }, time)
  })
}

const validLinkHeader = '<https://some-domain/docs.jsonld>; rel="http://www.w3.org/ns/hydra/core#apiDocumentation",<https://localhost:8443/.well-known/mercure>; rel="mercure"'

describe('API Documentation setDocsPathFromLinkHeader functionality', () => {
  const invalidLinkHeader = '<https://some-domain/docs.jsonld>; rel="http://INVALID",<https://localhost:8443/.well-known/mercure>; rel="mercure"'

  beforeEach(() => {
    const pinia = createTestingPinia({
      createSpy: vi.fn,
    })
    setActivePinia(pinia)
    vi.clearAllMocks()
  })

  test('The link header is parsed and set correctly', () => {
    const apiDocumentation = createApiDocumentation()
    const piniaStore = apiDocumentationStore.useStore()

    apiDocumentation.setDocsPathFromLinkHeader(validLinkHeader)
    expect(piniaStore.$patch).toHaveBeenCalledTimes(1)
    expect(piniaStore.$patch).toHaveBeenCalledWith({
      docsPath: 'https://some-domain/docs.jsonld',
    })
    expect(piniaStore.$state.docsPath).toBe('https://some-domain/docs.jsonld')
  })

  test('An invalid link header is handled', () => {
    const apiDocumentation = createApiDocumentation()
    const piniaStore = apiDocumentationStore.useStore()

    apiDocumentation.setDocsPathFromLinkHeader(invalidLinkHeader)
    expect(logger.error).toHaveBeenCalledWith('The "Link" HTTP header is not of the type "http://www.w3.org/ns/hydra/core#apiDocumentation".')
    expect(piniaStore.$patch).not.toHaveBeenCalled()
    expect(piniaStore.$state.docsPath).toBe(undefined)
  })

  test('The link header is not set if docsUrl already set', () => {
    const pinia = createTestingPinia({
      createSpy: vi.fn,
      initialState: {
        'storeName.apiDocumentation': {
          docsPath: 'https://someurl',
        },
      },
    })
    setActivePinia(pinia)

    const apiDocumentation = createApiDocumentation()
    const piniaStore = apiDocumentationStore.useStore()
    apiDocumentation.setDocsPathFromLinkHeader(validLinkHeader)
    expect(piniaStore.$patch).not.toHaveBeenCalled()
  })
})

describe('API Documentation getApiDocumentation functionality', () => {
  let apiDocumentation: ApiDocumentation

  const apiDocsObject = {
    docs: 'response from https://some-domain/docs.jsonld',
    entrypoint: 'response from /.jsonld',
    pageDataMetadata: 'response from /_/page_data_metadatas',
  }
  beforeAll(() => {
    const pinia = createTestingPinia({
      createSpy: vi.fn,
    })
    setActivePinia(pinia)
    apiDocumentation = createApiDocumentation()
  })

  test('We will wait for docsPath to be set before continuing', async () => {
    apiDocumentation.getApiDocumentation()
    expect(logger.debug).toHaveBeenLastCalledWith('Waiting for docsPath to bet set to fetch API Documentation')
    await flushPromises()
    expect(cwaFetchInstance.fetch).not.toHaveBeenCalled()
  })

  test('We proceed with fetching when set', async () => {
    // will proceed with fetching when set
    apiDocumentation.setDocsPathFromLinkHeader(validLinkHeader)
    vi.clearAllMocks()
    await flushPromises()
    expect(cwaFetchInstance.fetch).toHaveBeenCalledWith('/.jsonld')
    expect(cwaFetchInstance.fetch).toHaveBeenCalledWith('https://some-domain/docs.jsonld')
    await delay(mockedFetchResponseTime)
    const piniaStore = apiDocumentationStore.useStore()
    expect(piniaStore.$patch).toHaveBeenCalledTimes(1)
    expect(piniaStore.$patch).toHaveBeenCalledWith({
      apiDocumentation: apiDocsObject,
    })
  })

  test('We do not re-fetch on a second call', async () => {
    vi.clearAllMocks()
    const docs = await apiDocumentation.getApiDocumentation()
    const piniaStore = apiDocumentationStore.useStore()

    expect(docs).toEqual(apiDocsObject)
    expect(piniaStore.$patch).not.toHaveBeenCalled()
  })

  test('We can force the API documentation to be fetched again and another request for docs will wait and use the result from the first', async () => {
    vi.clearAllMocks()
    const docs = apiDocumentation.getApiDocumentation(true)
    const docsAwait = apiDocumentation.getApiDocumentation(true)

    const piniaStore = await apiDocumentationStore.useStore()
    expect(await docs).toEqual(apiDocsObject)
    expect(await docsAwait).toEqual(apiDocsObject)
    expect(logger.debug).toHaveBeenCalledWith('Waiting for previous request to complete for API Documentation')
    await flushPromises()
    expect(piniaStore.$patch).toHaveBeenCalledTimes(1)
  })
})
