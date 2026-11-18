<template>
  <CwaAuthLoginPage
    v-model="credentials"
    :error="error"
    :submitting="submitting"
    submit-button-text="Sign in"
    @submit="signIn"
  >
    <template #header>
      <CwaUiAlert
        tone="info"
        title="Use the username and password &quot;admin&quot; to log in to this preview version of CWA"
      />
    </template>
  </CwaAuthLoginPage>
</template>

<script setup lang="ts">
import { useHead } from '#app'
import { CwaAuthLoginPage } from '#components'
import { definePageMeta, useLogin } from '#imports'

const { error, submitting, signIn, credentials } = useLogin()

definePageMeta({
  cwa: {
    disabled: true,
  },
})

useHead({
  title: 'Login',
  bodyAttrs: {
    class: 'h-full',
  },
  htmlAttrs: {
    class: 'h-full bg-neutral-900',
  },
})
</script>
