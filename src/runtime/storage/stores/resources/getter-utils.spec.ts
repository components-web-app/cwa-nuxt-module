import { beforeEach, describe, expect, test } from 'vitest'
import { reactive } from 'vue'
import { CwaResourceApiStatuses, CwaResourcesStateInterface } from './state'
import { ResourcesGetterUtils } from './getter-utils'

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

describe('ResourcesStore Getter Utils -> resourcesApiStateIsPending', () => {
  let state: CwaResourcesStateInterface
  let getterUtils: ResourcesGetterUtils

  beforeEach(() => {
    state = createState()
    getterUtils = new ResourcesGetterUtils(state)
  })

  test('throws an error if a resource does not exist', () => {
    const byId = {
      id: {
        apiState: {
          status: CwaResourceApiStatuses.IN_PROGRESS
        }
      }
    }
    state.current.currentIds = Object.keys(byId)
    state.current.byId = byId
    expect(() => {
      getterUtils.resourcesApiStateIsPending(['some-token'])
    }).toThrowError('The resource \'some-token\' does not exist.')
  })

  test('returns false if no resources are pending', () => {
    const byId = {
      id: {
        apiState: {
          status: CwaResourceApiStatuses.SUCCESS
        }
      }
    }
    state.current.currentIds = Object.keys(byId)
    state.current.byId = byId
    expect(getterUtils.resourcesApiStateIsPending(['id'])).toBe(false)
  })

  test('returns true if there is a resource that is pending', () => {
    const byId = {
      id: {
        apiState: {
          status: CwaResourceApiStatuses.IN_PROGRESS
        }
      }
    }
    state.current.currentIds = Object.keys(byId)
    state.current.byId = byId
    expect(getterUtils.resourcesApiStateIsPending(['id'])).toBe(true)
  })
})

describe('ResourcesStore Getter Utils -> totalResourcesPending', () => {
  let state: CwaResourcesStateInterface
  let getterUtils: ResourcesGetterUtils

  beforeEach(() => {
    state = createState()
    getterUtils = new ResourcesGetterUtils(state)
  })

  test.each([
    {
      byId: {
        id: {
          apiState: {
            status: CwaResourceApiStatuses.IN_PROGRESS
          }
        }
      },
      total: 1
    },
    {
      byId: {
        id: {
          apiState: {
            status: CwaResourceApiStatuses.SUCCESS
          }
        }
      },
      total: 0
    }
  ])('Returns the correct number of pending resources', ({ byId, total }) => {
    state.current.currentIds = Object.keys(byId)
    state.current.byId = byId
    expect(getterUtils.totalResourcesPending).toBe(total)
  })
})
