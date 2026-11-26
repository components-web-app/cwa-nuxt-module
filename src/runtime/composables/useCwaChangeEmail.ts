import { computed, ref } from 'vue'
import { useCwa } from '#cwa/composables/cwa'
import { useCwaToast } from '#cwa/composables/cwa-toast'
import { writeOwnUser } from '#cwa/api/own-user-write'
import type { CwaUser } from '#cwa/storage/stores/auth/state'

export const useCwaChangeEmail = () => {
  const $cwa = useCwa()
  const toast = useCwaToast()
  const newEmail = ref('')
  const oldPassword = ref('')
  const submitting = ref(false)
  const fieldErrors = ref<Record<string, string>>({})
  const returned = ref<CwaUser>()

  const pending = computed<string | undefined>(() => ((returned.value ?? $cwa.auth.user)?.newEmailAddress as string | null | undefined) || undefined)

  async function write(data: Record<string, unknown>, fields: string[], failed: string) {
    submitting.value = true
    try {
      const { user, fieldErrors: errors, failure } = await writeOwnUser($cwa, data, fields)
      fieldErrors.value = errors
      if (failure) {
        toast.show({ tone: 'error', title: failed, description: failure })
      }
      if (user) {
        returned.value = user
      }
      return user
    }
    finally {
      submitting.value = false
    }
  }

  async function submit() {
    const user = await write({ newEmailAddress: newEmail.value, oldPassword: oldPassword.value }, ['newEmailAddress', 'oldPassword'], 'Your email wasn\'t changed.')
    if (!user) {
      return false
    }
    newEmail.value = ''
    oldPassword.value = ''
    return true
  }

  async function cancel() {
    return !!await write({ newEmailAddress: null }, ['newEmailAddress'], 'The email change wasn\'t cancelled.')
  }

  return { newEmail, oldPassword, submit, cancel, pending, submitting, fieldErrors }
}
