import { reactive, ref } from 'vue'
import { FetchError } from 'ofetch'
import { consola as logger } from 'consola'
import { navigateTo } from '#imports'
import { useCwa } from '#cwa/composables/cwa'

export const useForgotPassword = () => {
  const $cwa = useCwa()

  const credentials = reactive({
    username: '',
  })

  const error = ref<string | undefined>()
  const submitting = ref(false)
  const success = ref(false)

  function handleResetError(fetchError: FetchError) {
    if (fetchError.status === 429) {
      error.value = 'A reset email was already sent recently. Please check your inbox and spam folder.'
    }
    else if (fetchError.status === 503) {
      error.value = 'The email couldn\'t be sent. Please try again.'
    }
    else if (fetchError.status === 400) {
      error.value = 'The email couldn\'t be sent. Please contact the site administrator.'
      logger.warn('[CWA] The API refused to send the email (400). The likely cause is that this site\'s origin is not in the API\'s `user.email_links.allowed_origins` and no `default_origin` is configured.')
    }
    else if (fetchError.status === 404) {
      error.value = 'Username not found'
    }
    else {
      error.value = fetchError.data?.message || fetchError.statusMessage || 'Unexpected error'
    }
  }

  async function doSubmit() {
    if (success.value) {
      return navigateTo('/login')
    }
    if (!credentials.username) {
      error.value = 'Please enter a username'
      return
    }
    submitting.value = true
    error.value = undefined
    const response = await $cwa.auth.forgotPassword(credentials.username)
    if (response instanceof FetchError) {
      handleResetError(response)
    }
    else {
      success.value = true
    }
    submitting.value = false
  }

  return {
    doSubmit,
    credentials,
    error,
    submitting,
    success,
  }
}
