<template>
  <label
    class="cwa-block cwa-text-light/70"
    :for="inputId"
  >
    {{ label }}
  </label>
  <span class="cwa-flex cwa-relative">
    <slot />
  </span>
</template>

<script lang="ts" setup>
defineProps<{
  label: string
  inputId?: string
}>()
</script>
