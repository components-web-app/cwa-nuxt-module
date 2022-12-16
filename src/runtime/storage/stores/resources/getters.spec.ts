import { describe, test, expect, beforeEach } from 'vitest'
import { reactive } from 'vue'
import getters, { CwaResourcesGettersInterface } from './getters'
import { CwaResourceApiStatuses, CwaResourcesStateInterface } from './state'

function createState (): CwaResourcesStateInterface {
  return {
    current: reactive({
      byId: {},
      allIds: [],
      currentIds: []
    }),
    new: reactive({
      byId: {},
      allIds: []
    })
  }
}

describe('ResourcesStore Getters -> resourcesApiStateIsPending', () => {
  let state: CwaResourcesStateInterface
  let getterFns: CwaResourcesGettersInterface

  beforeEach(() => {
    state = createState()
    getterFns = getters(state)
  })

  test('returns false if no resources are pending', () => {
    expect(getterFns.resourcesApiStateIsPending.value).toBe(false)
  })

  test('returns true if there is a resource that is pending', () => {
    state.current.byId = {
      id: {
        apiState: {
          status: CwaResourceApiStatuses.IN_PROGRESS
        }
      }
    }
    expect(getterFns.resourcesApiStateIsPending.value).toBe(true)
  })
})

describe('ResourcesStore Getters -> totalResourcesPending', () => {
  let state: CwaResourcesStateInterface
  let getterFns: CwaResourcesGettersInterface

  beforeEach(() => {
    state = createState()
    getterFns = getters(state)
  })

  test('returns 0 if no resources are pending', () => {
    expect(getterFns.totalResourcesPending.value).toBe(0)
  })

  test('returns true if there is a resource that is pending', () => {
    state.current.currentIds = ['id']
    state.current.byId = {
      id: {
        apiState: {
          status: CwaResourceApiStatuses.IN_PROGRESS
        }
      }
    }
    expect(getterFns.totalResourcesPending.value).toBe(1)
  })
})
