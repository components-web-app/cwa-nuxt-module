<template>
  <LoginPage :error="error" :submitting="submitting" submit-button-text="Reset Password" @submit="signIn">
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
  </LoginPage>
</template>

<script setup>
import { navigateTo, useHead, useNuxtApp } from '#app'
import { reactive, ref } from 'vue'
import { FetchError } from 'ofetch'
import InputField from '../_components/login/InputField.vue'
import LoginPageLink from '@cwa/nuxt-module/layer/_components/login/LoginPageLink.vue'
import LoginPage from '@cwa/nuxt-module/layer/_components/login/LoginPage.vue'

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

const error = ref(null)
const submitting = ref(false)

async function signIn () {
  submitting.value = true
  error.value = null
  // const user = await $cwa.auth.signIn(credentials)
  // if (user instanceof FetchError) {
  //   error.value = user.data?.message || user.statusMessage
  // } else {
  //   navigateTo('/')
  // }
  submitting.value = false
}
</script>
