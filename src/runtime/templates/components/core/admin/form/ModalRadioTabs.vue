<script setup lang="ts">
defineProps<{
  options: { label: string, value: string | null }[]
  modelValue: string | null
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string | null] }>()
</script>

<template>
  <div class="cwa:flex cwa:rounded-lg cwa:overflow-hidden cwa:border cwa:border-stone-700">
    <button
      v-for="option in options"
      :key="String(option.value)"
      type="button"
      :aria-current="modelValue === option.value ? 'true' : undefined"
      class="cwa:flex-1 cwa:py-2 cwa:px-4 cwa:text-sm cwa:transition-colors cwa:cursor-pointer"
      :class="modelValue === option.value
        ? 'cwa:bg-blue-600 cwa:text-white'
        : 'cwa:bg-dark/90 cwa:text-stone-400 cwa:hover:text-white'"
      @click="emit('update:modelValue', option.value)"
    >
      {{ option.label }}
    </button>
  </div>
</template>
