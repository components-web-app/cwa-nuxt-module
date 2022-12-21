import { beforeEach, describe, expect, test, vi } from 'vitest'
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import consola from 'consola'
import { MercureStore } from '../storage/stores/mercure/mercure-store'
import { ResourcesStore } from '../storage/stores/resources/resources-store'
import Mercure from './mercure'

vi.mock('consola')
vi.mock('../resources/resource-utils')

let mercureStoreDef: MercureStore
let resourcesStoreDef: ResourcesStore
function createMercure (): Mercure {
  mercureStoreDef = new MercureStore('storeName')
  resourcesStoreDef = new ResourcesStore('storeName')
  return new Mercure(mercureStoreDef, resourcesStoreDef)
}

describe('Mercure -> setMercureHubFromLinkHeader', () => {
  const validLinkHeader = '<https://some-domain/docs.jsonld>; rel="http://www.w3.org/ns/hydra/core#apiDocumentation",<https://localhost:8443/.well-known/mercure>; rel="mercure"'
  const invalidLinkHeader = '<https://some-domain/docs.jsonld>; rel="http://INVALID", (INVALID); rel="mercure"'

  beforeEach(() => {
    const pinia = createTestingPinia({
      createSpy: vi.fn
    })
    setActivePinia(pinia)
    vi.clearAllMocks()
  })

  test('The link header is parsed and set correctly', () => {
    const mercure = createMercure()
    const mercureStore = mercureStoreDef.useStore()

    mercure.setMercureHubFromLinkHeader(validLinkHeader)
    expect(mercureStore.hub).toBe('https://localhost:8443/.well-known/mercure')
  })

  test('An invalid link header is handled', () => {
    const mercure = createMercure()
    const mercureStore = mercureStoreDef.useStore()

    mercure.setMercureHubFromLinkHeader(invalidLinkHeader)
    expect(consola.error).toHaveBeenCalledWith('No Mercure rel in link header.')
    expect(mercureStore.hub).toBeNull()
  })

  test('The link header is not set if docsUrl already set', () => {
    const pinia = createTestingPinia({
      createSpy: vi.fn,
      initialState: {
        'storeName.mercure': {
          hub: 'https://someurl'
        }
      }
    })
    setActivePinia(pinia)

    const mercure = createMercure()
    const mercureStore = mercureStoreDef.useStore()
    mercure.setMercureHubFromLinkHeader(validLinkHeader)
    expect(mercureStore.hub).toBe('https://someurl')
  })
})
