<script lang="ts" setup>
import { computed } from 'vue'

const props = withDefaults(defineProps<
{
  color: 'blue' | 'grey'
}>(), {
  color: 'grey'
})

const classNames = computed(() => {
  if (props.color === 'blue') {
    return 'cwa-text-white cwa-bg-blue-600/90 hover:cwa-bg-blue-600'
  }
  return 'cwa-text-white cwa-bg-stone-700/90 hover:cwa-bg-stone-700'
})
</script>

<template>
  <button class="cwa-py-1.5 cwa-px-2 md:cwa-px-4 cwa-border cwa-border-transparent" :class="classNames">
    <slot />
  </button>
</template>
