import { reactive } from 'vue'

export interface CwaAdminStateInterface {
  state: {
    isEditing: boolean
  }
}

export default function (): CwaAdminStateInterface {
  return {
    state: reactive({
      isEditing: false,
    }),
  }
}
