import type { CwaAdminStateInterface } from './state'

export interface CwaAdminActionsInterface {
  toggleEdit(isEditing?: boolean): void
}
export default function (adminState: CwaAdminStateInterface): CwaAdminActionsInterface {
  return {
    toggleEdit (isEditing?: boolean) {
      adminState.state.isEditing = isEditing !== undefined ? isEditing : !adminState.state.isEditing
      // reset navigation guard when we stop editing
      if (!adminState.state.isEditing) {
        adminState.state.navigationGuardDisabled = false
      }
    }
  }
}
