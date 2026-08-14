import { ref } from 'vue'
import { FetchError } from 'ofetch'
import { useCwa } from '#cwa/composables/cwa'

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

  async function resendVerifyEmail(username: string, type: 'current' | 'new' = 'current') {
    if (!username) {
      error.value = 'Please enter a username'
      return
    }
    submitting.value = true
    error.value = undefined
    // only an explicit 'new' targets the pending email change endpoint - anything
    // else (including a JS caller passing nothing) verifies the current address
    const callFunction = (type: 'current' | 'new') => {
      if (type === 'new') {
        return $cwa.auth.resendVerifyNewEmail(username)
      }
      return $cwa.auth.resendVerifyEmail(username)
    }
    const response = await callFunction(type)
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
