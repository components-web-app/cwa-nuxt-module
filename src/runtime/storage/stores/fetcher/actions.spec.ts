import { describe, vi, test, expect, beforeEach } from 'vitest'
import { reactive } from 'vue'
import { ResourcesStore } from '../resources/resources-store'
import { CwaFetcherAsyncResponse } from '../../../api/fetcher/fetcher'
import actions, { fetcherInitTypes } from './actions'
import { CwaFetcherStateInterface } from './state'
import getters from './getters'

vi.mock('../resources/resources-store')

function createState (state?: {
  fetch?: {
    path?: string
    paths?: { [key: string]: CwaFetcherAsyncResponse|undefined }
    success?: boolean
  }
  fetched?: {
    path?: string
  }
}): CwaFetcherStateInterface {
  return {
    status: reactive({
      fetch: {
        path: state?.fetch?.path,
        paths: state?.fetch?.paths || {},
        success: state?.fetch?.success
      },
      fetched: {
        path: state?.fetched?.path
      }
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
    const state = createState({ fetch: { path: 'fetching-path' } })
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
  beforeEach(() => {
    vi.clearAllMocks()
  })
  // should not initialise
  test('When starting a fetch we should not continue if the current fetch is the same path', () => {
    const state = createState({ fetch: { path: 'fetching-path' } })
    const getterFns = getters(state)
    const fetcherActions = actions(state, getterFns, resourcesStore)
    const shouldContinue = fetcherActions.initFetchStatus({
      type: fetcherInitTypes.START,
      path: 'fetching-path'
    })
    expect(shouldContinue).toBeFalsy()
    expect(resourcesStore.useStore).not.toHaveBeenCalled()
    expect(state.status.fetch.success).toBeUndefined()
    expect(state.status.fetch.path).toBe('fetching-path')
  })

  test('When starting a fetch we should not continue if the previous fetch is the same path', () => {
    const state = createState({ fetched: { path: 'fetched-path' } })
    const getterFns = getters(state)
    const fetcherActions = actions(state, getterFns, resourcesStore)
    const shouldContinue = fetcherActions.initFetchStatus({
      type: fetcherInitTypes.START,
      path: 'fetched-path'
    })
    expect(shouldContinue).toBeFalsy()
    expect(resourcesStore.useStore).not.toHaveBeenCalled()
    expect(state.status.fetch.success).toBeUndefined()
    expect(state.status.fetch.path).toBeUndefined()
  })

  test('When starting a fetch we should tell the caller to continue if a fetch is already in progress so it can do the fetch and add a new endpoint to the paths', () => {
    const state = createState({ fetch: { path: 'fetching-path' } })
    const getterFns = getters(state)
    const fetcherActions = actions(state, getterFns, resourcesStore)
    const shouldContinue = fetcherActions.initFetchStatus({
      type: fetcherInitTypes.START,
      path: 'another-path'
    })
    expect(shouldContinue).toBeTruthy()
    expect(resourcesStore.useStore).not.toHaveBeenCalled()
    expect(state.status.fetch.success).toBeUndefined()
    expect(state.status.fetch.path).toBe('fetching-path')
  })

  test('When finishing a fetch, we should only continue if the path matches what we are initially fetching', () => {
    const state = createState({ fetch: { path: 'fetching-path' } })
    const getterFns = getters(state)
    const fetcherActions = actions(state, getterFns, resourcesStore)
    const shouldContinue = fetcherActions.initFetchStatus({
      type: fetcherInitTypes.FINISH,
      path: 'another-path',
      fetchSuccess: true
    })
    expect(shouldContinue).toBeTruthy()
    expect(resourcesStore.useStore).not.toHaveBeenCalled()
    expect(state.status.fetch.success).toBeUndefined()
    expect(state.status.fetch.path).toBe('fetching-path')
  })

  // will successfully initialise
  test('When starting a fetch we should call to reset the current resources. Response should be true', () => {
    const resetCurrentResources = vi.fn()
    // @ts-ignore
    vi.spyOn(resourcesStore, 'useStore').mockImplementation(() => ({
      resetCurrentResources
    }))
    const state = createState({ fetch: { success: true } })
    const getterFns = getters(state)
    const fetcherActions = actions(state, getterFns, resourcesStore)
    const shouldContinue = fetcherActions.initFetchStatus({
      type: fetcherInitTypes.START,
      path: 'fetch-path',
      resetCurrentResources: true
    })
    expect(shouldContinue).toBeTruthy()
    expect(resourcesStore.useStore).toHaveBeenCalled()
    expect(resetCurrentResources).toHaveBeenCalled()
    expect(state.status.fetch.path).toBe('fetch-path')
    expect(state.status.fetch.success).toBeTruthy()
  })

  test('When starting a fetch we should not call to reset the current resources if not specified. Response should be true', () => {
    const state = createState()
    const getterFns = getters(state)
    const fetcherActions = actions(state, getterFns, resourcesStore)
    const shouldContinue = fetcherActions.initFetchStatus({
      type: fetcherInitTypes.START,
      path: 'fetch-path'
    })
    expect(shouldContinue).toBeTruthy()
    expect(resourcesStore.useStore).not.toHaveBeenCalled()
    expect(state.status.fetch.path).toBe('fetch-path')
    expect(state.status.fetch.success).toBeUndefined()
  })

  test('When finishing a fetch, we should set the fetch success. Response should be true', () => {
    const state = createState({ fetch: { path: 'fetching-path' } })
    const getterFns = getters(state)
    const fetcherActions = actions(state, getterFns, resourcesStore)
    const shouldContinue = fetcherActions.initFetchStatus({
      type: fetcherInitTypes.FINISH,
      path: 'fetching-path',
      fetchSuccess: true
    })
    expect(shouldContinue).toBeTruthy()
    expect(resourcesStore.useStore).not.toHaveBeenCalled()
    expect(state.status.fetch.success).toBeTruthy()
    expect(state.status.fetch.path).toBeUndefined()
  })

  test('When finishing a fetch, if successful the fetched path should be updated and current path set as undefined. Paths should be cleared. fetchedPage should not be set', () => {
    // @ts-ignore
    const state = createState({ fetch: { path: 'fetching-path', paths: { currentPath: 'else' } } })
    const getterFns = getters(state)
    const fetcherActions = actions(state, getterFns, resourcesStore)
    const shouldContinue = fetcherActions.initFetchStatus({
      type: fetcherInitTypes.FINISH,
      path: 'fetching-path',
      fetchSuccess: true
    })
    expect(shouldContinue).toBeTruthy()
    expect(state.status.fetch.paths).toStrictEqual({})
    expect(state.status.fetch.success).toBeTruthy()
    expect(state.status.fetch.path).toBeUndefined()
    expect(state.status.fetched.path).toBe('fetching-path')
    expect(state.fetchedPage).toBeUndefined()
  })

  test('When finishing a fetch, if successful and a page iri is provided the fetchedPage should be set', () => {
    const state = createState({ fetch: { path: 'fetching-path' } })
    const getterFns = getters(state)
    const fetcherActions = actions(state, getterFns, resourcesStore)
    const shouldContinue = fetcherActions.initFetchStatus({
      type: fetcherInitTypes.FINISH,
      path: 'fetching-path',
      fetchSuccess: true,
      pageIri: 'page-iri'
    })
    expect(shouldContinue).toBeTruthy()
    expect(state.fetchedPage).toStrictEqual({
      path: 'fetching-path',
      iri: 'page-iri'
    })
  })
})
