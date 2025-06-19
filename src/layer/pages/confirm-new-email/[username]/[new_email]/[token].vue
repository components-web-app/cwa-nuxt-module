<script setup lang="ts">
import AuthTemplate from '#cwa/runtime/templates/components/main/auth/_parts/AuthTemplate.vue'
import { definePageMeta } from '#imports'

definePageMeta({
  cwa: {
    disabled: true,
  },
})
</script>

<template>
  <AuthTemplate
    :submitting="true"
    :submit-button-text="'Hello'"
    :error="'Not working'"
    @submit="$emit('submit')"
  >
    TOKEN
  </AuthTemplate>
</template>
