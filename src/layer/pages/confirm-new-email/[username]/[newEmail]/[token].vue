<script setup lang="ts">
import { onMounted } from 'vue'
import AuthTemplate from '#cwa/templates/components/main/auth/_parts/AuthTemplate.vue'
import CwaUiSpinner from '#cwa/templates/components/ui/Spinner.vue'
import { definePageMeta, useHead, useVerifyEmail } from '#imports'

useHead({
  title: 'Confirm New Email',
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
  confirmEmail,
  error,
  submitting,
  success,
  getStringFromParam,
} = useVerifyEmail()

onMounted(() => {
  confirmEmail()
})
</script>

<template>
  <AuthTemplate
    title="Confirm your new email"
    :submitting="submitting"
    submit-button-text="Verify Email"
    :error="error"
    :success="success ? 'New email address confirmed' : undefined"
    :hide-submit="!!(success || error)"
    @submit="confirmEmail"
  >
    <p
      v-if="!success && !error"
      class="cwa:m-0 cwa:flex cwa:items-center cwa:gap-2"
    >
      <CwaUiSpinner v-if="submitting" />
      <span class="cwa:min-w-0">{{ submitting ? 'Confirming' : 'Verify your new email address' }} <span class="cwa:font-semibold cwa:break-all">{{ getStringFromParam('newEmail') }}</span></span>
    </p>
  </AuthTemplate>
</template>
