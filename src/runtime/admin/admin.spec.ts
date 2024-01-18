// @vitest-environment nuxt
import { describe, expect, test, vi, beforeEach, Mock } from 'vitest'
import mitt from 'mitt'
import { AdminStore } from '../storage/stores/admin/admin-store'
import { ResourcesStore } from '../storage/stores/resources/resources-store'
import Admin from './admin'
import ResourceManager from './resource-manager'

vi.mock('./resource-manager', () => {
  return {
    default: vi.fn()
  }
})

vi.mock('../storage/stores/admin/admin-store', () => {
  return {
    AdminStore: vi.fn(() => ({
      useStore: vi.fn(() => ({
        toggleEdit: vi.fn(),
        state: {
          isEditing: 'isEdit',
          navigationGuardDisabled: 'ngs'
        }
      }))
    }))
  }
})

vi.mock('mitt', () => {
  return {
    default: vi.fn()
  }
})

function createAdmin () {
  return new Admin(new AdminStore('storeName'), new ResourcesStore('storeName'))
}
describe('Admin class', () => {
  let admin = null

  beforeEach(() => {
    vi.clearAllMocks()
    admin = createAdmin()
  })
  test('toggleEdit', () => {
    const toggleSpy = vi.fn()

    admin.adminStoreDefinition.useStore = () => ({
      toggleEdit: toggleSpy,
      state: {
        isEditing: 'isEdit',
        navigationGuardDisabled: 'ngs'
      }
    })

    expect(admin.toggleEdit(true)).toBeUndefined()
    expect(toggleSpy).toHaveBeenCalledWith(true)
  })
  test('setNavigationGuardDisabled', () => {
    const mockState = {
      isEditing: 'isEdit',
      navigationGuardDisabled: 'ngs'
    }

    admin.adminStoreDefinition.useStore = () => ({
      toggleEdit: vi.fn(),
      state: mockState
    })

    expect(admin.setNavigationGuardDisabled(false)).toBeUndefined()
    expect(mockState.navigationGuardDisabled).toBe(false)
  })
  test('navigationGuardDisabled getter', () => {
    expect(admin.navigationGuardDisabled).toBe(AdminStore.mock.results[0].value.useStore.mock.results[0].value.state.navigationGuardDisabled)
  })
  test('isEditing getter', () => {
    expect(admin.isEditing).toBe(AdminStore.mock.results[0].value.useStore.mock.results[0].value.state.isEditing)
  })
  test('adminStore getter', () => {
    const mockStore = {
      toggleEdit: vi.fn(),
      state: {}
    }

    admin.adminStoreDefinition.useStore = () => mockStore

    expect(admin.adminStore).toBe(mockStore)
  })
  test('event bus was created AND accessible via getter', () => {
    const mockMitt = { mock: 'mitt' }

    mitt.mockReturnValueOnce(mockMitt)

    admin = createAdmin()

    expect(mitt).toHaveBeenCalled()
    expect(admin.eventBus).toEqual(mockMitt)
  })

  test('should have component manager created', () => {
    admin = createAdmin()

    expect(ResourceManager as Mock).toHaveBeenCalledWith(admin.adminStoreDefinition, admin.resourcesStoreDefinition)
  })
})
