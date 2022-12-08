import { describe, vi, test, expect } from 'vitest'
import { reactive } from 'vue'
import { ResourcesStore } from '../resources/resources-store'
import actions from './actions'
import { CwaFetcherStateInterface } from './state'
import getters from './getters'

vi.mock('../resources/resources-store')

function createState (path?: string): CwaFetcherStateInterface {
  return {
    status: reactive({
      fetch: {
        path,
        paths: {}
      },
      fetched: {}
    })
  }
}

const resourcesStore = new ResourcesStore('storeName')

describe('FetcherStore addPath context', () => {
  test('path is not added if we are not fetching', () => {
    const state = createState()
    const getterFns = getters(state)
    const fetcherActions = actions(state, getterFns, resourcesStore)

    // @ts-ignore
    fetcherActions.addPath('endpoint', 'something')
    expect(state.status.fetch.paths).toStrictEqual({})
  })

  test('path is added if we are fetching', () => {
    const state = createState('fetching-path')
    const getterFns = getters(state)
    const fetcherActions = actions(state, getterFns, resourcesStore)

    // @ts-ignore
    fetcherActions.addPath('endpoint', 'something')
    expect(state.status.fetch.paths).toStrictEqual({
      endpoint: 'something'
    })
  })
})

describe('FetcherStore initFetchStatus context', () => {
  test.todo('When starting a fetch we should not continue if the previous fetch is the same path', () => {

  })
  test.todo('When starting a fetch we should tell the caller to continue if a fetch is already in progress so it can do the fetch and add a new endpoint to the paths', () => {

  })
  test.todo('When finishing a fetch, we should only continue if the path matches what we are initially fetching', () => {

  })
  test.todo('When starting a fetch we should call to reset the current resources. Response should be true', () => {

  })
  test.todo('When starting a fetch we should assign the fetching path to the store', () => {

  })
  test.todo('When finishing a fetch, we should set the fetch status. Response should be true', () => {

  })
  test.todo('When finishing a fetch, if successful the fetched path should be updated and current path set as undefined. Paths should be cleared. fetchedPage should not be set', () => {

  })
  test.todo('When finishing a fetch, if successful and a page iri is provided the fetchedPage should be set', () => {

  })
})
