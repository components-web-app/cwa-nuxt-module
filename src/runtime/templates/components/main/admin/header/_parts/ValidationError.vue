<script lang="ts" setup>
import type { CwaViolationError } from '#cwa/runtime/storage/stores/error/state'

defineProps<{
  violation: CwaViolationError
}>()
</script>

<template>
  <li class="cwa-py-2">
    {{ violation.property }}: {{ violation.message }}
  </li>
</template>
