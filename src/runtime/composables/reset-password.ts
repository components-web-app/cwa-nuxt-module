import { computed, reactive, ref } from 'vue'
import { FetchError } from 'ofetch'
import { navigateTo, useRoute } from '#app'
import { useCwa } from '#cwa/runtime/composables/cwa'

export const useResetPassword = () => {
  const route = useRoute()
  const $cwa = useCwa()

  const error = ref<string|null>(null)
  const submitting = ref(false)
  const success = ref(false)
  const submittedFormIri = ref<string|null>(null)

  const passwords = reactive({
    first: '',
    second: ''
  })

  const inputErrors = computed(() => {
    const formIri = submittedFormIri.value
    if (!formIri) {
      return
    }
    return {
      form: $cwa.forms.getFormViewErrors(formIri, 'password_update').value,
      password: $cwa.forms.getFormViewErrors(formIri, 'password_update[plainPassword][first]').value
    }
  })

  submittedFormIri.value && $cwa.forms.getFormViewErrors(submittedFormIri.value, 'password_update[plainPassword][first]')

  function getStringFromParam (paramName: string): string {
    const paramValue = route.params[paramName]
    return Array.isArray(paramValue) ? paramValue[0] : paramValue
  }

  function handleResetError (fetchError: FetchError) {
    if (fetchError.status === 404) {
      return 'The reset link is invalid or has expired. Please restart the reset password process.'
    }
    if (fetchError.status === 422) {
      $cwa.resourcesManager.saveResource({
        resource: fetchError.data
      })
      submittedFormIri.value = fetchError.data['@id']
      return
    }
    return fetchError.data?.message || fetchError.statusMessage || 'Unexpected error'
  }

  async function resetPassword () {
    if (success.value) {
      navigateTo('/login')
    }
    const previousFormIri = submittedFormIri.value
    if (previousFormIri) {
      $cwa.resourcesManager.removeResource({ resource: previousFormIri })
      submittedFormIri.value = null
    }
    submitting.value = true
    error.value = null
    const response = await $cwa.auth.resetPassword({
      username: getStringFromParam('username'),
      token: getStringFromParam('token'),
      passwords
    })
    if (response instanceof FetchError) {
      error.value = handleResetError(response)
    } else {
      success.value = true
    }
    submitting.value = false
  }
  return {
    error,
    submitting,
    success,
    passwords,
    inputErrors,
    resetPassword
  }
}
