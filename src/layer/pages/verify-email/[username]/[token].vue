<script setup lang="ts">
import { onMounted } from 'vue'
import AuthTemplate from '#cwa/templates/components/main/auth/_parts/AuthTemplate.vue'
import CwaUiSpinner from '#cwa/templates/components/ui/Spinner.vue'
import { definePageMeta, useHead, useVerifyEmail } from '#imports'

useHead({
  title: 'Verify Email',
  bodyAttrs: {
    class: 'cwa:h-full',
  },
  htmlAttrs: {
    class: 'cwa:h-full cwa:bg-stone-950',
  },
})

definePageMeta({
  cwa: {
    disabled: true,
  },
})

const {
  verifyEmail,
  error,
  submitting,
  success,
} = useVerifyEmail()

onMounted(() => {
  verifyEmail()
})
</script>

<template>
  <AuthTemplate
    title="Verify your email"
    :submitting="submitting"
    submit-button-text="Verify Email"
    :error="error"
    :success="success ? 'Your email address is now verified' : undefined"
    :hide-submit="!!(success || error)"
    @submit="verifyEmail"
  >
    <p
      v-if="!success && !error"
      class="cwa:m-0 cwa:flex cwa:items-center cwa:gap-2"
    >
      <CwaUiSpinner v-if="submitting" />
      <span>{{ submitting ? 'Verifying your email address' : 'Verify your email address' }}</span>
    </p>
  </AuthTemplate>
</template>
