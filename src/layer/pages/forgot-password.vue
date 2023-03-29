<template>
  <LoginPage :error="error" :submitting="submitting" :submit-button-text="success ? 'Back to Login' : 'Reset Password'" @submit="doSubmit">
    <div v-if="success">
      <h1 class="cwa-font-bold cwa-text-xl cwa-mb-2">
        Please check your inbox
      </h1>
      <p>We've sent you an email with a link to reset your password</p>
    </div>
    <template v-else>
      <InputField
        v-model="credentials.username"
        label="Username or Email"
        name="username"
        type="text"
        autocomplete="username"
        :required="true"
      />
      <div class="cwa-flex cwa-items-center cwa-justify-between">
        <LoginPageLink link-to="/login" link-text="< Back to login" />
      </div>
    </template>
  </LoginPage>
</template>

<script setup lang="ts">
import { navigateTo, useHead, useNuxtApp } from '#app'
import { reactive, ref } from 'vue'
import { FetchError } from 'ofetch'
import InputField from '../_components/login/InputField.vue'
import LoginPageLink from '@cwa/nuxt-module/layer/_components/login/LoginPageLink.vue'
import LoginPage from '@cwa/nuxt-module/layer/_components/login/LoginPage.vue'
import { definePageMeta } from '#imports'

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
</script>
