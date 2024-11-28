<template>
  <CwaAuthForgotPasswordPage
    v-model="credentials"
    :error="error"
    :submitting="submitting"
    :success="success"
    @submit="doSubmit"
  />
</template>

<script setup lang="ts">
import { useHead } from '#app'
import { definePageMeta, useForgotPassword } from '#imports'
import { CwaAuthForgotPasswordPage } from '#components'

const { doSubmit, credentials, error, submitting, success } = useForgotPassword()

definePageMeta({
  cwa: {
    disabled: true,
  },
})

useHead({
  bodyAttrs: {
    class: 'cwa-h-full',
  },
  htmlAttrs: {
    class: 'cwa-h-full cwa-bg-neutral-900',
  },
})
</script>
