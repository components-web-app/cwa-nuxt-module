<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  modelValue: string | number | undefined | null
}>()

const emit = defineEmits(['update:modelValue'])

const value = computed({
  get() {
    return props.modelValue
  },
  set(value) {
    emit('update:modelValue', value)
  },
})
</script>

<template>
  <input
    v-model="value"
    class="disabled:cwa-opacity-50 disabled:cwa-cursor-not-allowed disabled:cwa-pointer-events-none disabled:cwa-select-none cwa-text-light cwa-w-full cwa-dark-blur cwa-border-0 cwa-outline-dotted cwa-outline-1 cwa-outline-stone-700 hover:cwa-outline-stone-400 focus-visible:cwa-ring-2 focus-visible:cwa-ring-stone-600"
  >
</template>
