import { reactive, ref } from 'vue'
import { FetchError } from 'ofetch'
import { navigateTo } from '#app'
import { useCwa } from '#cwa/runtime/composables/cwa'

export const useForgotPassword = () => {
  const $cwa = useCwa()

  const credentials = reactive({
    username: ''
  })

  const error = ref<string|null>(null)
  const submitting = ref(false)
  const success = ref(false)

  function handleResetError (fetchError: FetchError) {
    if (fetchError.status === 404) {
      error.value = 'Username not found'
    } else {
      error.value = fetchError.data?.message || fetchError.statusMessage || 'Unexpected error'
    }
  }

  async function doSubmit () {
    if (success.value) {
      navigateTo('/login')
    }
    if (!credentials.username) {
      error.value = 'Please enter a username'
      return
    }
    submitting.value = true
    error.value = null
    const response = await $cwa.auth.forgotPassword(credentials.username)
    if (response instanceof FetchError) {
      handleResetError(response)
    } else {
      success.value = true
    }
    submitting.value = false
  }

  return {
    doSubmit,
    credentials,
    error,
    submitting,
    success
  }
}
