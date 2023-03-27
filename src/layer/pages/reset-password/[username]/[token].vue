<template>
  <LoginPage :error="inputErrors?.form || error" :submitting="submitting" :submit-button-text="success ? 'Go to Login' : 'Reset Password'" @submit="resetPassword">
    <div v-if="success">
      <h1 class="cwa-font-bold cwa-text-xl cwa-mb-2">
        Password Reset
      </h1>
      <p>You have successfully reset your password.</p>
    </div>
    <template v-else>
      <InputField
        v-model="passwords.first"
        label="Enter new password"
        name="firstPassword"
        type="password"
        autocomplete="new-password"
        :errors="inputErrors?.password"
        :required="true"
      />
      <InputField
        v-model="passwords.second"
        label="Repeat new password"
        name="secondPassword"
        type="password"
        autocomplete="new-password"
        :required="true"
      />
    </template>
  </LoginPage>
</template>

<script setup lang="ts">
import { navigateTo, useHead, useNuxtApp, useRoute } from '#app'
import { computed, reactive, ref } from 'vue'
import { FetchError } from 'ofetch'
import InputField from '../../../_components/login/InputField.vue'
import LoginPage from '@cwa/nuxt-module/layer/_components/login/LoginPage.vue'
import { definePageMeta } from '#imports'

const route = useRoute()
const { $cwa } = useNuxtApp()

definePageMeta({
  cwa: false
})

useHead({
  bodyAttrs: {
    class: 'cwa-h-full'
  },
  htmlAttrs: {
    class: 'cwa-h-full cwa-bg-neutral-900'
  }
})

const error = ref<string|null>(null)
const submitting = ref(false)
const success = ref(false)
const submittedFormIri = ref<string|null>(null)

const passwords = reactive({
  first: '',
  second: ''
})

const form = computed(() => {
  const formIri = submittedFormIri.value
  if (!formIri) {
    return
  }
  return $cwa.forms.getForm(formIri)
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

$cwa.forms.getFormViewErrors(submittedFormIri.value, 'password_update[plainPassword][first]')

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
    $cwa.resourcesManager.deleteResource({ resource: previousFormIri })
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
</script>
