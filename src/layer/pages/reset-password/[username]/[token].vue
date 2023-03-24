<template>
  <LoginPage :error="error" :submitting="submitting" submit-button-text="Back to login" @submit="goToLogin">
    <p>Page not complete. Please contact an administrator to change your password</p>
    <pre class="cwa-overflow-auto cwa-text-xs">{{ route.params }}</pre>
  </LoginPage>
</template>

<script setup>
import { navigateTo, useHead, useRoute } from '#app'
import { ref } from 'vue'
import LoginPage from '@cwa/nuxt-module/layer/_components/login/LoginPage.vue'

const route = useRoute()

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

const error = ref(null)
const submitting = ref(false)

function goToLogin () {
  navigateTo('/login')
}
</script>
