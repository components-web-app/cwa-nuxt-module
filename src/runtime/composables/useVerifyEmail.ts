import { ref } from 'vue'
import { FetchError } from 'ofetch'
import { useRoute } from '#app'
import { useCwa } from '#cwa/runtime/composables/cwa'

export const useVerifyEmail = () => {
  const route = useRoute()
  const $cwa = useCwa()

  const error = ref<string | undefined>()
  const submitting = ref(false)
  const success = ref(false)

  function getStringFromParam(paramName: string): string {
    const paramValue = route.params[paramName]
    return Array.isArray(paramValue) ? paramValue[0] : paramValue
  }

  function handleResetError(fetchError: FetchError) {
    if (fetchError.status === 404) {
      error.value = 'Request expired or has already been used.'
    }
    else {
      error.value = fetchError.data?.message || fetchError.statusMessage || 'Unexpected error'
    }
  }

  async function verifyEmail() {
    const username = getStringFromParam('username')
    if (!username) {
      error.value = 'No username specified'
      return
    }
    const token = getStringFromParam('token')
    if (!token) {
      error.value = 'No token specified'
      return
    }
    submitting.value = true
    error.value = undefined

    const response = await $cwa.auth.verifyEmail({
      username,
      token,
    })

    if (response instanceof FetchError) {
      handleResetError(response)
    }
    else {
      success.value = true
    }
    submitting.value = false
  }

  async function confirmEmail() {
    const username = getStringFromParam('username')
    if (!username) {
      error.value = 'No username specified'
      return
    }
    const token = getStringFromParam('token')
    if (!token) {
      error.value = 'No token specified'
      return
    }
    const newEmail = getStringFromParam('newEmail')
    if (!newEmail) {
      error.value = 'No new email specified'
      return
    }
    submitting.value = true
    error.value = undefined

    const response = await $cwa.auth.confirmEmail({
      username,
      token,
      newEmail,
    })

    if (response instanceof FetchError) {
      handleResetError(response)
    }
    else {
      success.value = true
    }
    submitting.value = false
  }

  return {
    verifyEmail,
    confirmEmail,
    error,
    submitting,
    success,
    getStringFromParam,
  }
}
