import { Ref, ref } from 'vue'

export interface CwaAdminStateInterface {
  isEditing: Ref<boolean>,
  navigationGuardDisabled: Ref<boolean>,
  editResourceStack: Ref<string[]|null>
}

export default function (): CwaAdminStateInterface {
  return {
    isEditing: ref(false),
    navigationGuardDisabled: ref(false),
    editResourceStack: ref(null)
  }
}
