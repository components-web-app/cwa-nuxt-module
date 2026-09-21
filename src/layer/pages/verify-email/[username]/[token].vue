<script setup lang="ts">
import { onMounted } from 'vue'
import AuthTemplate from '#cwa/templates/components/main/auth/_parts/AuthTemplate.vue'
import SpinnerTick from '#cwa/templates/components/utils/SpinnerTick.vue'
import { definePageMeta, useHead, useVerifyEmail } from '#imports'

useHead({ title: 'Verify Email' })

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
    :submitting="submitting"
    submit-button-text="Verify Email"
    :error="error"
    :hide-submit="!!(success || error)"
    @submit="verifyEmail"
  >
    <div
      v-if="!error"
      class="cwa:flex cwa:gap-x-2"
    >
      <div v-if="submitting || success">
        <SpinnerTick :is-loading="submitting" />
      </div>
      <div v-if="success">
        Your email address is now verified
      </div>
      <div v-else-if="!submitting">
        Verify your email address
      </div>
    </div>
  </AuthTemplate>
</template>
