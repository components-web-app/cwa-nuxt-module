import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import { reactive } from 'vue'
import { CwaResourceTypes } from '../../../resources/resource-utils'
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

describe('ResourcesStore Getters -> resourcesByType', () => {
  let state: CwaResourcesStateInterface
  let getterFns: CwaResourcesGettersInterface

  beforeEach(() => {
    state = createState()
    getterFns = getters(state)
  })

  test('returns current resources with their type as the object key', () => {
    state.current.currentIds = ['/_/routes/id', '/random-to-exclude']
    state.current.byId = {
      '/_/routes/id': {
        apiState: {
          status: CwaResourceApiStatuses.IN_PROGRESS
        },
        data: {
          '@id': '/_/routes/id'
        }
      },
      '/random-to-exclude': {
        apiState: {
          status: CwaResourceApiStatuses.IN_PROGRESS
        },
        data: {
          '@id': '/random-to-exclude'
        }
      }
    }
    expect(getterFns.resourcesByType.value).toStrictEqual({
      [CwaResourceTypes.ROUTE]: [{
        '@id': '/_/routes/id'
      }],
      [CwaResourceTypes.PAGE]: [],
      [CwaResourceTypes.PAGE_DATA]: [],
      [CwaResourceTypes.LAYOUT]: [],
      [CwaResourceTypes.COMPONENT_GROUP]: [],
      [CwaResourceTypes.COMPONENT_POSITION]: [],
      [CwaResourceTypes.COMPONENT]: []
    })
  })
})

describe('ResourcesStore Getters -> resourcesApiStateIsPending', () => {
  let state: CwaResourcesStateInterface
  let getterFns: CwaResourcesGettersInterface

  beforeEach(() => {
    state = createState()
    getterFns = getters(state)
  })

  test('returns false if no resources are pending', () => {
    expect(getterFns.currentResourcesApiStateIsPending.value).toBe(false)
  })

  test('returns true if there is a resource that is pending', () => {
    state.current.byId = {
      id: {
        apiState: {
          status: CwaResourceApiStatuses.IN_PROGRESS
        }
      }
    }
    expect(getterFns.currentResourcesApiStateIsPending.value).toBe(true)
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
