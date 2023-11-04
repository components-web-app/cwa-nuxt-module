<script lang="ts" setup>
import { computed } from 'vue'

const props = withDefaults(defineProps<
{
  color?: 'blue' | 'grey' | 'dark'
}>(), {
  color: 'grey'
})

const classNames = computed(() => {
  if (props.color === 'blue') {
    return 'cwa-text-white cwa-bg-blue-600/90 hover:cwa-bg-blue-600 cwa-border-transparent'
  }
  if (props.color === 'dark') {
    return 'cwa-text-light cwa-bg-dark/90 hover:cwa-bg-dark cwa-border-stone-400 hover:cwa-border-white hover:cwa-text-white'
  }
  return 'cwa-text-white cwa-bg-stone-700/90 hover:cwa-bg-stone-700 cwa-border-transparent'
})
</script>

<template>
  <button class="cwa-py-1.5 cwa-px-2 md:cwa-px-4 cwa-border cwa-transition" :class="classNames">
    <slot />
  </button>
</template>
