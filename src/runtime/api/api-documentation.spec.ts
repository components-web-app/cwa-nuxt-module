import { describe, test, vi, beforeEach, expect, beforeAll } from 'vitest'
import { setActivePinia } from 'pinia'
import consola from 'consola'
import { createTestingPinia } from '@pinia/testing'
import { $fetch } from 'ohmyfetch'
import { ApiDocumentationStore } from '../storage/stores/api-documentation/api-documentation-store'
import { CwaApiDocumentationDataInterface } from '../storage/stores/api-documentation/state'
import ApiDocumentation from './api-documentation'

vi.mock('consola')

const mockedFetchResponseTime = 100
vi.mock('ohmyfetch', () => {
  return {
    $fetch: vi.fn(async (path) => {
      await new Promise((resolve) => {
        setTimeout(resolve, 100)
      })
      return 'response from ' + path
    })
  }
})

vi.mock('../storage/stores/api-documentation/state')

let apiDocumentationStore: ApiDocumentationStore
function createApiDocumentation (): ApiDocumentation {
  apiDocumentationStore = new ApiDocumentationStore('storeName')
  return new ApiDocumentation('https://dummy-api-url', apiDocumentationStore)
}

function delay (time: number, returnValue: any = undefined) {
  return new Promise((resolve) => {
    setTimeout(() => { resolve(returnValue) }, time)
  })
}

const validLinkHeader = '<https://some-domain/docs.jsonld>; rel="http://www.w3.org/ns/hydra/core#apiDocumentation",<https://localhost:8443/.well-known/mercure>; rel="mercure"'

describe('API Documentation setDocsPathFromLinkHeader functionality', () => {
  const invalidLinkHeader = '<https://some-domain/docs.jsonld>; rel="http://INVALID",<https://localhost:8443/.well-known/mercure>; rel="mercure"'

  beforeEach(() => {
    const pinia = createTestingPinia({
      createSpy: vi.fn
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
      docsPath: 'https://some-domain/docs.jsonld'
    })
    expect(piniaStore.$state.docsPath).toBe('https://some-domain/docs.jsonld')
  })

  test('An invalid link header is handled', () => {
    const apiDocumentation = createApiDocumentation()
    const piniaStore = apiDocumentationStore.useStore()

    apiDocumentation.setDocsPathFromLinkHeader(invalidLinkHeader)
    expect(consola.error).toHaveBeenCalledWith('The "Link" HTTP header is not of the type "http://www.w3.org/ns/hydra/core#apiDocumentation".')
    expect(piniaStore.$patch).not.toHaveBeenCalled()
    expect(piniaStore.$state.docsPath).toBe(undefined)
  })

  test('The link header is not set if docsUrl already set', () => {
    const pinia = createTestingPinia({
      createSpy: vi.fn,
      initialState: {
        'storeName.apiDocumentation': {
          docsPath: 'https://someurl'
        }
      }
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
  let getDocsPromise: Promise<CwaApiDocumentationDataInterface|undefined>
  const apiDocsObject = {
    docs: 'response from https://some-domain/docs.jsonld',
    entrypoint: 'response from https://dummy-api-url'
  }
  beforeAll(() => {
    const pinia = createTestingPinia({
      createSpy: vi.fn
    })
    setActivePinia(pinia)
    apiDocumentation = createApiDocumentation()
  })

  test('We will wait for docsPath to be set before continuing', async () => {
    getDocsPromise = apiDocumentation.getApiDocumentation()
    expect(consola.debug).toHaveBeenLastCalledWith('Waiting for docsPath to bet set to fetch API Documentation')
    await delay(5)
    expect($fetch).not.toHaveBeenCalled()
  })
  test('We proceed with fetching when set', async () => {
    // will proceed with fetching when set
    apiDocumentation.setDocsPathFromLinkHeader(validLinkHeader)
    vi.clearAllMocks()
    await delay(5)
    const headers = {
      accept: 'application/ld+json,application/json'
    }
    expect($fetch).toHaveBeenCalledWith('https://dummy-api-url', { headers })
    expect($fetch).toHaveBeenCalledWith('https://some-domain/docs.jsonld', { headers })
    await delay(mockedFetchResponseTime)
    const piniaStore = apiDocumentationStore.useStore()
    expect(piniaStore.$patch).toHaveBeenCalledTimes(1)
    expect(piniaStore.$patch).toHaveBeenCalledWith({
      apiDocumentation: apiDocsObject
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
    expect(consola.debug).toHaveBeenCalledWith('Waiting for previous request to complete for API Documentation')
    await delay(mockedFetchResponseTime)
    expect(piniaStore.$patch).toHaveBeenCalledTimes(1)
  })
})
