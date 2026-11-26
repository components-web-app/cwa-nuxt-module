import { ref } from 'vue'
import { useCwa } from '#cwa/composables/cwa'
import { useCwaToast } from '#cwa/composables/cwa-toast'
import { writeOwnUser } from '#cwa/api/own-user-write'

export const useCwaChangePassword = () => {
  const $cwa = useCwa()
  const toast = useCwaToast()
  const oldPassword = ref('')
  const password = ref('')
  const repeatPassword = ref('')
  const submitting = ref(false)
  const saved = ref(false)
  const fieldErrors = ref<Record<string, string>>({})

  async function submit() {
    saved.value = false
    if (password.value !== repeatPassword.value) {
      fieldErrors.value = { repeatPassword: 'The passwords don\'t match.' }
      return false
    }
    submitting.value = true
    try {
      const { user, fieldErrors: errors, failure } = await writeOwnUser($cwa, { oldPassword: oldPassword.value, plainPassword: password.value }, ['oldPassword', 'plainPassword'])
      const { plainPassword, ...others } = errors
      fieldErrors.value = plainPassword ? { ...others, password: plainPassword } : others
      if (failure) {
        toast.show({ tone: 'error', title: 'Your password wasn\'t changed.', description: failure })
      }
      if (!user) {
        return false
      }
      oldPassword.value = ''
      password.value = ''
      repeatPassword.value = ''
      saved.value = true
      return true
    }
    finally {
      submitting.value = false
    }
  }

  return { oldPassword, password, repeatPassword, submit, submitting, fieldErrors, saved }
}
