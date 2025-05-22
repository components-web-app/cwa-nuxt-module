import { reactive, ref } from 'vue'
import { FetchError } from 'ofetch'
import { navigateTo } from '#app'
import { useCwa } from '#cwa/runtime/composables/cwa'

export const useLogin = () => {
  const $cwa = useCwa()

  const credentials = reactive({
    username: '',
    password: '',
  })

  const error = ref()
  const submitting = ref(false)

  async function signIn() {
    submitting.value = true
    error.value = undefined
    const user = await $cwa.auth.signIn(credentials)
    if (user instanceof FetchError) {
      error.value = user.data?.message || user.statusMessage || 'Unknown/Network Error'
    }
    else {
      navigateTo('/')
    }
    submitting.value = false
  }

  return {
    credentials,
    error,
    submitting,
    signIn,
  }
}
