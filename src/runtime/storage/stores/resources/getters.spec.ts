import { describe, test, expect, beforeEach } from 'vitest'
import { reactive } from 'vue'
import getters, { CwaResourcesGettersInterface } from './getters'
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
          status: 0
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
          status: 0
        }
      }
    }
    expect(getterFns.totalResourcesPending.value).toBe(1)
  })
})
