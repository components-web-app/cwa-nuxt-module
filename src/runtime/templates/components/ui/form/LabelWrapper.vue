<template>
  <div class="cwa-flex cwa-items-center cwa-space-x-4">
    <div>
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
