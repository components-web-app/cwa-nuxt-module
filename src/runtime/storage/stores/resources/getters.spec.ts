import { describe, test, expect } from 'vitest'
import { reactive } from 'vue'
import getters from './getters'
import { CwaResourcesStateInterface } from './state'

function createState (): CwaResourcesStateInterface {
  return {
    current: reactive({
      byId: reactive({}),
      allIds: [],
      currentIds: []
    }),
    new: reactive({
      byId: reactive({}),
      allIds: []
    })
  }
}

describe('Fetcher::resourcesApiStateIsPending', () => {
  const state = createState()
  const getterFns = getters(state)

  test('returns false if not resources are pending', () => {
    expect(getterFns.resourcesApiStateIsPending.value).toBe(false)
  })

  test('returns true if there is a resource that is pending', () => {
    state.current.byId = {
      id: {
        apiState: {
          status: 0
        }
      }
    }
    expect(getterFns.resourcesApiStateIsPending.value).toBe(true)
  })
})
