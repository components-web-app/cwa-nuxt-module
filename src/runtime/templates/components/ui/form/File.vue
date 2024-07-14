<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  label: string,
  modelValue: string|number|undefined|null
}>()

const emit = defineEmits(['update:modelValue'])

const value = computed({
  get () {
    return props.modelValue
  },
  set (value) {
    emit('update:modelValue', value)
  }
})
</script>

<template>
  <div class="cwa-flex cwa-items-center">
    <CwaUiFormButton>
      {{ label }}
    </CwaUiFormButton>
    <span class="cwa-ml-3 cwa-text-sm cwa-cursor-pointer cwa-font-medium">
      {{ value || 'No File' }}
    </span>
  </div>
</template>
