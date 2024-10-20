import { reactive } from 'vue'

export interface CwaAdminStateInterface {
  state: {
    isEditing: boolean
    navigationGuardDisabled: boolean
  }
}

export default function (): CwaAdminStateInterface {
  return {
    state: reactive({
      isEditing: false,
      navigationGuardDisabled: false,
    }),
  }
}
