import { describe, test, vi, beforeEach, expect } from 'vitest'
import { setActivePinia } from 'pinia'
import consola from 'consola'
import { createTestingPinia } from '@pinia/testing'
import { ApiDocumentationStore } from '../storage/stores/api-documentation/api-documentation-store'
import ApiDocumentation from './api-documentation'

vi.mock('consola')
vi.mock('ohmyfetch')
vi.mock('../storage/stores/api-documentation/state')

let apiDocumentationStore: ApiDocumentationStore
function createApiDocumentation () {
  apiDocumentationStore = new ApiDocumentationStore('storeName')
  return new ApiDocumentation('https://dummy-api-url', apiDocumentationStore)
}

describe('API Documentation setDocsPathFromLinkHeader functionality', () => {
  const validLinkHeader = '<https://some-domain/docs.jsonld>; rel="http://www.w3.org/ns/hydra/core#apiDocumentation",<https://localhost:8443/.well-known/mercure>; rel="mercure"'
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
