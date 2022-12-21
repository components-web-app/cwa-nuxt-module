import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
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

describe('ResourcesStore Getters -> resourceLoadStatus', () => {
  let state: CwaResourcesStateInterface
  let getterFns: CwaResourcesGettersInterface

  beforeEach(() => {
    state = createState()
    getterFns = getters(state)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  test.each([
    { total: 0, complete: 0, expectedPercent: 100 },
    { total: 1, complete: 0, expectedPercent: 0 },
    { total: 2, complete: 1, expectedPercent: 50 },
    { total: 3, complete: 1, expectedPercent: 33 },
    { total: 3, complete: 3, expectedPercent: 100 }
  ])('If the total to fetch is $total and we have loaded $complete the percentage should be $expectedPercent', ({ total, complete, expectedPercent }) => {
    const pending = total - complete
    const currentIds = Array.from(Array(total).keys())
    state.current = reactive({
      allIds: currentIds,
      currentIds,
      byId: {}
    })
    for (const id of currentIds) {
      state.current.byId[id] = {
        apiState: {
          status: id < complete ? CwaResourceApiStatuses.SUCCESS : CwaResourceApiStatuses.IN_PROGRESS
        }
      }
    }
    expect(getterFns.resourceLoadStatus.value).toStrictEqual({
      complete,
      pending,
      percent: expectedPercent,
      total
    })
  })
})
