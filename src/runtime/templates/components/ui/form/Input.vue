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
    class="cwa:disabled:opacity-50 cwa:disabled:cursor-not-allowed cwa:disabled:pointer-events-none cwa:disabled:select-none cwa:text-light cwa:w-full cwa:dark-blur cwa:border-0 cwa:outline-dotted cwa:outline-1 cwa:outline-stone-700 cwa:hover:outline-stone-400 cwa:focus-visible:ring-2 cwa:focus-visible:ring-stone-600"
  >
</template>
