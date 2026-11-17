<script setup lang="ts">
import { computed } from 'vue'

const { size = 'md' } = defineProps<{
  size?: 'sm' | 'md'
}>()

const sizeClasses = computed(() => size === 'sm' ? 'cwa:size-3 cwa:border-[1.5px]' : 'cwa:size-4 cwa:border-2')
</script>

<template>
  <span
    aria-hidden="true"
    class="cwa:inline-block cwa:shrink-0 cwa:rounded-full cwa:border-current/28 cwa:border-t-current cwa:animate-spinner cwa:motion-reduce:animate-spinner-reduced"
    :class="sizeClasses"
  />
</template>
