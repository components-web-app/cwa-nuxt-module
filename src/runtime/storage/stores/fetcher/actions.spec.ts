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
    path: string
    success?: boolean,
    token: string
  }
  fetched?: {
    path: string
  }
}): CwaFetcherStateInterface {
  return {
    status: reactive({
      fetch: state?.fetch,
      fetched: state?.fetched
    })
  }
}

const resourcesStore = new ResourcesStore('storeName')

describe('FetcherStore initFetchStatus context', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  // should not initialise
  test('When starting a fetch we should not continue if the current fetch is the same path even with a new token', () => {
    const state = createState({ fetch: { path: 'fetching-path', token: 'start-token' } })
    const getterFns = getters(state)
    const fetcherActions = actions(state, getterFns, resourcesStore)
    const shouldContinue = fetcherActions.initFetchStatus({
      type: fetcherInitTypes.START,
      path: 'fetching-path',
      token: 'new-start-token'
    })
    expect(shouldContinue).toBeFalsy()
    expect(resourcesStore.useStore).not.toHaveBeenCalled()
    expect(state.status.fetch?.success).toBeUndefined()
    expect(state.status.fetch?.path).toBe('fetching-path')
  })

  test('When starting a fetch we should not continue if the previous fetch is the same path', () => {
    const state = createState({ fetched: { path: 'fetched-path' } })
    const getterFns = getters(state)
    const fetcherActions = actions(state, getterFns, resourcesStore)
    const shouldContinue = fetcherActions.initFetchStatus({
      type: fetcherInitTypes.START,
      path: 'fetched-path',
      token: 'some-token'
    })
    expect(shouldContinue).toBeFalsy()
    expect(resourcesStore.useStore).not.toHaveBeenCalled()
    expect(state.status.fetch).toBeUndefined()
  })

  test('When starting a fetch we should tell the caller to continue if a fetch is already in progress so it can do the fetch and add a new endpoint to the paths', () => {
    const state = createState({ fetch: { path: 'fetching-path', token: 'some-token' } })
    const getterFns = getters(state)
    const fetcherActions = actions(state, getterFns, resourcesStore)
    const shouldContinue = fetcherActions.initFetchStatus({
      type: fetcherInitTypes.START,
      path: 'another-path',
      token: 'another-token'
    })
    expect(shouldContinue).toBeTruthy()
    expect(resourcesStore.useStore).not.toHaveBeenCalled()
    expect(state.status.fetch?.success).toBeUndefined()
    expect(state.status.fetch?.path).toBe('fetching-path')
  })

  test('When finishing a fetch, we should not continue if the token does not match what we are initially fetching', () => {
    const state = createState({ fetch: { path: 'fetching-path', token: 'start-token' } })
    const getterFns = getters(state)
    const fetcherActions = actions(state, getterFns, resourcesStore)
    const shouldContinue = fetcherActions.initFetchStatus({
      type: fetcherInitTypes.FINISH,
      fetchSuccess: true,
      token: 'different-start-token'
    })
    expect(shouldContinue).toBeFalsy()
    expect(resourcesStore.useStore).not.toHaveBeenCalled()
    expect(state.status.fetch?.success).toBeUndefined()
    expect(state.status.fetch?.path).toBe('fetching-path')
  })

  // will successfully initialise
  test('When starting a fetch we should call to reset the current resources. Response should be true', () => {
    const resetCurrentResources = vi.fn()
    // @ts-ignore
    vi.spyOn(resourcesStore, 'useStore').mockImplementation(() => ({
      resetCurrentResources
    }))
    const state = createState({ fetch: { path: 'previous-path', token: 'previous-token', success: true } })
    const getterFns = getters(state)
    const fetcherActions = actions(state, getterFns, resourcesStore)
    const shouldContinue = fetcherActions.initFetchStatus({
      type: fetcherInitTypes.START,
      path: 'fetch-path',
      resetCurrentResources: true,
      token: 'new-token'
    })
    expect(shouldContinue).toBeTruthy()
    expect(resourcesStore.useStore).toHaveBeenCalled()
    expect(resetCurrentResources).toHaveBeenCalled()
    expect(state.status.fetch).toStrictEqual({
      path: 'fetch-path',
      token: 'new-token'
    })
  })

  test('When starting a fetch we should not call to reset the current resources if not specified. Response should be true', () => {
    const state = createState()
    const getterFns = getters(state)
    const fetcherActions = actions(state, getterFns, resourcesStore)
    const shouldContinue = fetcherActions.initFetchStatus({
      type: fetcherInitTypes.START,
      path: 'fetch-path',
      token: 'a-new-token'
    })
    expect(shouldContinue).toBeTruthy()
    expect(resourcesStore.useStore).not.toHaveBeenCalled()
    expect(state.status.fetch).toStrictEqual({
      path: 'fetch-path',
      token: 'a-new-token'
    })
  })

  test('When finishing a fetch, we should set the fetch success. Response should be true', () => {
    const state = createState({ fetch: { path: 'fetching-path', token: 'my-token' } })
    const getterFns = getters(state)
    const fetcherActions = actions(state, getterFns, resourcesStore)
    const shouldContinue = fetcherActions.initFetchStatus({
      type: fetcherInitTypes.FINISH,
      fetchSuccess: true,
      token: 'my-token'
    })
    expect(shouldContinue).toBeTruthy()
    expect(resourcesStore.useStore).not.toHaveBeenCalled()
    expect(state.status.fetch).toStrictEqual({
      path: 'fetching-path',
      token: 'my-token',
      success: true
    })
  })

  test('When finishing a fetch, if successful the fetched path should be updated and current path set as undefined. fetchedPage should not be set', () => {
    const state = createState({ fetch: { path: 'fetching-path', token: 'token' } })
    const getterFns = getters(state)
    const fetcherActions = actions(state, getterFns, resourcesStore)
    const shouldContinue = fetcherActions.initFetchStatus({
      type: fetcherInitTypes.FINISH,
      token: 'token',
      fetchSuccess: true
    })
    expect(shouldContinue).toBeTruthy()
    expect(state.status.fetch).toStrictEqual({
      path: 'fetching-path',
      token: 'token',
      success: true
    })
    expect(state.status.fetched?.path).toBe('fetching-path')
    expect(state.fetchedPage).toBeUndefined()
  })

  test('When finishing a fetch, if successful and a page iri is provided the fetchedPage should be set', () => {
    const state = createState({ fetch: { path: 'fetching-path', token: 'set-page-token' } })
    const getterFns = getters(state)
    const fetcherActions = actions(state, getterFns, resourcesStore)
    const shouldContinue = fetcherActions.initFetchStatus({
      type: fetcherInitTypes.FINISH,
      token: 'set-page-token',
      fetchSuccess: true,
      pageIri: 'page-iri'
    })
    expect(shouldContinue).toBeTruthy()
    expect(state.fetchedPage).toStrictEqual({
      path: 'fetching-path',
      iri: 'page-iri'
    })
  })

  test('When finishing a fetch that was not successful we should not update the fetched path', () => {
    const state = createState({ fetch: { path: 'fetching-path', token: 'toe-can' } })
    const getterFns = getters(state)
    const fetcherActions = actions(state, getterFns, resourcesStore)
    const shouldContinue = fetcherActions.initFetchStatus({
      type: fetcherInitTypes.FINISH,
      token: 'toe-can',
      fetchSuccess: false
    })
    expect(shouldContinue).toBeTruthy()
    expect(state.status.fetch).toStrictEqual({
      path: 'fetching-path',
      token: 'toe-can',
      success: false
    })
    expect(state.status.fetched).toBeUndefined()
    expect(state.fetchedPage).toBeUndefined()
  })
})
