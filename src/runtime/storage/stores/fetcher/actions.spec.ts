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

describe.todo('FetcherStore actions context', () => {
  test('initFetchStatus action', () => {

  })
})
