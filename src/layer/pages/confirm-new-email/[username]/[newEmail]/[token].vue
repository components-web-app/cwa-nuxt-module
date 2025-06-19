<script setup lang="ts">
import { onMounted } from 'vue'
import AuthTemplate from '#cwa/runtime/templates/components/main/auth/_parts/AuthTemplate.vue'
import SpinnerTick from '#cwa/runtime/templates/components/utils/SpinnerTick.vue'
import { definePageMeta, useVerifyEmail } from '#imports'

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
    :submitting="submitting"
    submit-button-text="Verify Email"
    :error="error"
    :hide-submit="!!(success || error)"
    @submit="confirmEmail"
  >
    <div
      v-if="!error"
      class="cwa:flex cwa:gap-x-2"
    >
      <div v-if="submitting || success">
        <SpinnerTick :is-loading="submitting" />
      </div>
      <div v-if="success">
        New email address confirmed
      </div>
      <div v-else-if="!submitting">
        Verify your new email address <span class="cwa:font-bold">{{ getStringFromParam('newEmail') }}</span>
      </div>
    </div>
  </AuthTemplate>
</template>
