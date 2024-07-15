<script setup lang="ts">
import { computed, ref } from 'vue'

const props = defineProps<{
  label: string,
  modelValue: string|number|undefined|null
  accept?: string
}>()

const fileInput = ref()

const emit = defineEmits(['update:modelValue'])

const value = computed({
  get () {
    return props.modelValue
  },
  set (value) {
    emit('update:modelValue', value)
  }
})

function showFileSelect () {
  const clickEvent = new MouseEvent('click', {
    view: window,
    bubbles: true,
    cancelable: false
  })
  fileInput.value.dispatchEvent(clickEvent)
}
</script>

<template>
  <div class="cwa-flex cwa-items-center cwa-select-none">
    <input
      ref="fileInput"
      :accept="accept"
      class="cwa-absolute cwa-h-full cwa-w-full cwa-top-0 cwa-left-0 cwa-opacity-0 cwa-outline-0"
      type="file"
    >
    <CwaUiFormButton @click="showFileSelect">
      {{ label }}
    </CwaUiFormButton>
    <span class="cwa-ml-3 cwa-text-sm cwa-cursor-pointer cwa-font-medium">
      {{ value || 'No File' }}
    </span>
  </div>
</template>
