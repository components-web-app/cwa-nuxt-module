// @vitest-environment happy-dom
import { describe, expect, test, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'
import mitt from 'mitt'
import { AdminStore } from '../storage/stores/admin/admin-store'
import { ResourcesStore } from '../storage/stores/resources/resources-store'
import { Resources } from '../resources/resources'
import Admin from './admin'
import ResourceStackManager from './resource-stack-manager'

vi.mock('./resource-manager', () => {
  return {
    default: vi.fn(),
  }
})

vi.mock('../resources/resources')
vi.mock('./resource-stack-manager', () => {
  return {
    default: vi.fn(function () {
      return {
        showManager: { value: '' },
        isEditingLayout: { value: '' },
      }
    }),
  }
})

let adminStoreMock = {
  toggleEdit: vi.fn(),
  state: {
    isEditing: 'isEdit',
    navigationGuardDisabled: 'ngs',
  },
}

vi.mock('../storage/stores/admin/admin-store', () => {
  return {
    AdminStore: vi.fn(function() {
      return {
        useStore: vi.fn(() => adminStoreMock),
      }
    }),
  }
})

vi.mock('../storage/stores/resources/resources-store', () => {
  return {
    ResourcesStore: vi.fn(function() {
      return {
        useStore: vi.fn(() => ({})),
      }
    }),
  }
})

vi.mock('mitt', () => {
  return {
    default: vi.fn(() => ({
      on: vi.fn(),
    })),
  }
})

function createAdmin() {
  return new Admin(new AdminStore('storeName'), new ResourcesStore('storeName'), new Resources())
}

describe('Admin class', () => {
  let admin: Admin | null = null

  beforeEach(() => {
    vi.clearAllMocks()
    admin = null
  })

  test('toggleEdit', () => {
    const toggleSpy = vi.fn()

    adminStoreMock = {
      toggleEdit: toggleSpy,
      state: {
        isEditing: 'isEdit',
        navigationGuardDisabled: 'ngs',
      },
    }

    admin = createAdmin()

    expect(admin.toggleEdit(true)).toBeUndefined()
    expect(toggleSpy).toHaveBeenCalledWith(true)
  })
  test('setNavigationGuardDisabled', () => {
    const mockState = {
      isEditing: 'isEdit',
      navigationGuardDisabled: 'ngs',
    }

    adminStoreMock = {
      toggleEdit: vi.fn(),
      state: mockState,
    }

    admin = createAdmin()

    expect(admin.setNavigationGuardDisabled(false)).toBeUndefined()
    expect(mockState.navigationGuardDisabled).toBe(false)
  })
  test('navigationGuardDisabled getter', () => {
    admin = createAdmin()
    expect(admin.navigationGuardDisabled).toBe(AdminStore.mock.results[0].value.useStore.mock.results[0].value.state.navigationGuardDisabled)
  })
  test('isEditing getter', () => {
    admin = createAdmin()
    expect(admin.isEditing).toBe(AdminStore.mock.results[0].value.useStore.mock.results[0].value.state.isEditing)
  })
  test('adminStore getter', () => {
    const mockStore = {
      toggleEdit: vi.fn(),
      state: {},
    }

    adminStoreMock = mockStore

    admin = createAdmin()

    expect(admin.adminStore).toBe(mockStore)
  })
  test('event bus was created AND accessible via getter', () => {
    const mockMitt = { mock: 'mitt', on: vi.fn() }

    mitt.mockReturnValueOnce(mockMitt)

    admin = createAdmin()

    expect(mitt).toHaveBeenCalled()
    expect(admin.eventBus).toEqual(mockMitt)
  })

  test('should have component manager created', () => {
    admin = createAdmin()

    expect(ResourceStackManager as Mock).toHaveBeenCalledWith(AdminStore.mock.results[0].value, ResourcesStore.mock.results[0].value, Resources.mock.results[0].value)
  })
})
