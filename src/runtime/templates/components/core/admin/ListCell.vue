<script setup lang="ts">
const { align, action = false } = defineProps<{
  align?: 'end'
  action?: boolean
}>()

defineSlots<{
  default?(): any
}>()
</script>

<template>
  <div
    role="cell"
    class="cwa:min-w-0 cwa:text-control cwa:text-fg-secondary"
    :class="[
      action ? 'cwa:relative cwa:z-[1] cwa:flex cwa:justify-end' : 'cwa:max-md:hidden',
      { 'cwa:text-end cwa:tabular-nums': align === 'end' },
    ]"
  >
    <slot />
  </div>
</template>
