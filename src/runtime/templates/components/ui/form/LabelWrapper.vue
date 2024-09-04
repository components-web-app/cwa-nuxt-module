<template>
  <div class="cwa-flex cwa-items-center cwa-space-x-2">
    <div class="cwa-text-sm">
      {{ label }}
    </div>
    <div>
      <slot />
    </div>
  </div>
</template>

<script lang="ts" setup>
defineProps<{
  label: string
}>()
</script>
