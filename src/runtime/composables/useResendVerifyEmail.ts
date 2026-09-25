import { getCurrentScope, onScopeDispose, ref } from 'vue'
import { FetchError } from 'ofetch'
import { useCwa } from '#cwa/composables/cwa'
import { formatWait, retryAfterSeconds } from '#cwa/api/retry-after'

export const useResendVerifyEmail = () => {
  const $cwa = useCwa()

  const error = ref<string | undefined>()
  const submitting = ref(false)
  const success = ref(false)
  const retryIn = ref(0)
  let countdown: ReturnType<typeof setInterval> | undefined

  function stopCountdown() {
    clearInterval(countdown)
    countdown = undefined
  }

  function startCountdown(seconds: number) {
    stopCountdown()
    retryIn.value = seconds
    countdown = setInterval(() => {
      retryIn.value = Math.max(retryIn.value - 1, 0)
      if (!retryIn.value) {
        stopCountdown()
      }
    }, 1000)
  }

  if (getCurrentScope()) {
    onScopeDispose(stopCountdown)
  }

  function handleResetError(fetchError: FetchError) {
    if (fetchError.status === 429) {
      const seconds = retryAfterSeconds(fetchError)
      error.value = `A confirmation email was already sent. You can send another ${seconds ? `in ${formatWait(seconds)}` : 'shortly'}.`
      if (seconds) {
        startCountdown(seconds)
      }
    }
    else if (fetchError.status === 404) {
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
    retryIn,
  }
}
