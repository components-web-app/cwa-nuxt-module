import { describe, expect, test, vi, beforeEach } from 'vitest'
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

function createAdmin () {
  return new Admin(new AdminStore('storeName'))
}
describe('Admin class', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  test('toggleEdit', () => {
    const cls = createAdmin()
    expect(cls.toggleEdit(true)).toBeUndefined()
    expect(AdminStore.mock.results[0].value.useStore.mock.results[0].value.toggleEdit).toHaveBeenCalledWith(true)
  })
  test('setNavigationGuardDisabled', () => {
    const cls = createAdmin()
    expect(cls.setNavigationGuardDisabled(false)).toBeUndefined()
    expect(AdminStore.mock.results[0].value.useStore.mock.results[0].value.state.navigationGuardDisabled).toBe(false)
  })
  test('navigationGuardDisabled getter', () => {
    const cls = createAdmin()
    expect(cls.navigationGuardDisabled).toBe(AdminStore.mock.results[0].value.useStore.mock.results[0].value.state.navigationGuardDisabled)
  })
  test('isEditing getter', () => {
    const cls = createAdmin()
    expect(cls.isEditing).toBe(AdminStore.mock.results[0].value.useStore.mock.results[0].value.state.isEditing)
  })
  test('adminStore getter', () => {
    const cls = createAdmin()
    expect(cls.adminStore).toBe(AdminStore.mock.results[0].value.useStore.mock.results[0].value)
  })
})
