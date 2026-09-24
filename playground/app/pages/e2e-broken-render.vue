<script lang="ts" setup>
import { createError, definePageMeta } from '#imports'

definePageMeta({
  layout: 'cwa-root-layout',
})

throw createError({ statusCode: 500, statusMessage: 'E2E render failure', fatal: true })
</script>

<template>
  <div />
</template>
