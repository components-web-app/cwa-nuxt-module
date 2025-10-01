<template>
  <CwaAuthLoginPage
    v-model="credentials"
    :error="error"
    :submitting="submitting"
    submit-button-text="Sign In"
    @submit="signIn"
  />
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
    class: 'cwa:h-full',
  },
  htmlAttrs: {
    class: 'cwa:h-full cwa:bg-neutral-900',
  },
})
</script>
