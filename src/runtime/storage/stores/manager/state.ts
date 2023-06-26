import { Ref, ref } from 'vue'

export interface CwaManagerStateInterface {
  isEditing: Ref<boolean>,
  navigationGuardDisabled: Ref<boolean>,
  editResourceStack: Ref<string[]|null>
}

export default function (): CwaManagerStateInterface {
  return {
    isEditing: ref(false),
    navigationGuardDisabled: ref(false),
    editResourceStack: ref(null)
  }
}
