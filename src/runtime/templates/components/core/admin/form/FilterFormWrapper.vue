<template>
  <label>
    <span class="cwa-block cwa-text-light/70">
      {{ label }}
    </span>
    <span class="cwa-flex cwa-relative">
      <slot />
    </span>
  </label>
</template>

<script lang="ts" setup>
defineProps<{
  label: string
}>()
</script>
