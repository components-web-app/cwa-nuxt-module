import { describe, expect, test, vi, beforeEach } from 'vitest'
import mitt from 'mitt'
import { AdminStore } from '../storage/stores/admin/admin-store'
import Admin from './admin'

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
  return new Admin(new AdminStore('storeName'))
}
describe('Admin class', () => {
  let admin = null

  beforeEach(() => {
    vi.clearAllMocks()
    admin = createAdmin()
  })
  test('toggleEdit', () => {
    expect(admin.toggleEdit(true)).toBeUndefined()
    expect(AdminStore.mock.results[0].value.useStore.mock.results[0].value.toggleEdit).toHaveBeenCalledWith(true)
  })
  test('setNavigationGuardDisabled', () => {
    expect(admin.setNavigationGuardDisabled(false)).toBeUndefined()
    expect(AdminStore.mock.results[0].value.useStore.mock.results[0].value.state.navigationGuardDisabled).toBe(false)
  })
  test('navigationGuardDisabled getter', () => {
    expect(admin.navigationGuardDisabled).toBe(AdminStore.mock.results[0].value.useStore.mock.results[0].value.state.navigationGuardDisabled)
  })
  test('isEditing getter', () => {
    expect(admin.isEditing).toBe(AdminStore.mock.results[0].value.useStore.mock.results[0].value.state.isEditing)
  })
  test('adminStore getter', () => {
    expect(admin.adminStore).toBe(AdminStore.mock.results[0].value.useStore.mock.results[0].value)
  })
  test('event bus was created AND accessible via getter', () => {
    const mockMitt = { mock: 'mitt' }

    mitt.mockReturnValueOnce(mockMitt)

    admin = createAdmin()

    expect(mitt).toHaveBeenCalled()
    expect(admin.eventBus).toEqual(mockMitt)
  })
})
