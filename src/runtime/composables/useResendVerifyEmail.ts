import { ref } from 'vue'
import { FetchError } from 'ofetch'
import { useCwa } from '#cwa/runtime/composables/cwa'

export const useResendVerifyEmail = () => {
  const $cwa = useCwa()

  const error = ref<string | undefined>()
  const submitting = ref(false)
  const success = ref(false)

  function handleResetError(fetchError: FetchError) {
    if (fetchError.status === 404) {
      error.value = 'Username not found'
    }
    else {
      error.value = fetchError.data?.message || fetchError.statusMessage || 'Unexpected error'
    }
  }

  async function resendVerifyEmail(username: string, type: 'current' | 'new') {
    if (!username) {
      error.value = 'Please enter a username'
      return
    }
    submitting.value = true
    error.value = undefined
    const callFunction = (type: 'current' | 'new') => {
      if (type === 'current') {
        return $cwa.auth.resendVerifyEmail(username)
      }
      return $cwa.auth.resendVerifyNewEmail(username)
    }
    const response = callFunction(type)
    if (response instanceof FetchError) {
      handleResetError(response)
    }
    else {
      success.value = true
    }
    submitting.value = false
  }

  return {
    resendVerifyEmail,
    error,
    submitting,
    success,
  }
}
