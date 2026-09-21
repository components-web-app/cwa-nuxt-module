<template>
  <CwaAuthResetPasswordPage
    v-model="passwords"
    :error="error"
    :submitting="submitting"
    :success="success"
    :input-errors="inputErrors"
    @submit="resetPassword"
  />
</template>

<script setup lang="ts">
import { definePageMeta, useHead, useResetPassword } from '#imports'

const {
  error,
  submitting,
  success,
  passwords,
  inputErrors,
  resetPassword,
} = useResetPassword()

definePageMeta({
  cwa: {
    disabled: true,
  },
})

useHead({
  title: 'Reset Password',
  bodyAttrs: {
    class: 'cwa:h-full',
  },
  htmlAttrs: {
    class: 'cwa:h-full cwa:bg-neutral-900',
  },
})
</script>
