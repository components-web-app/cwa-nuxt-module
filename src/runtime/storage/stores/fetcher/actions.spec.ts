import { describe, vi, test } from 'vitest'
import { ResourcesStore } from '../resources/resources-store'
import actions from './actions'
import state from './state'

vi.mock('../resources/resources-store')

describe.todo('FetcherStore actions context', () => {
  // beforeEach - lets setup the store proper so we can check on updating the state as we need to

  const resourcesStore = new ResourcesStore('storeName')
  const fetcherActions = actions(state(), resourcesStore)
  test('addPath action', () => {
    // fetcherActions.addPath('endpoint', 'something')
  })
})
