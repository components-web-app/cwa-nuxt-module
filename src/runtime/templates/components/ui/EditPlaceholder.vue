<script setup lang="ts">
const { label } = defineProps<{
  label: string
}>()
</script>

<template>
  <div
    data-testid="edit-placeholder"
    class="cwa:flex cwa:min-h-16 cwa:flex-col cwa:items-center cwa:justify-center cwa:gap-2 cwa:border cwa:border-line-strong cwa:bg-surface cwa:p-4 cwa:text-center cwa:text-label cwa:text-fg-muted"
  >
    <span>{{ label }}</span>
    <slot />
  </div>
</template>
