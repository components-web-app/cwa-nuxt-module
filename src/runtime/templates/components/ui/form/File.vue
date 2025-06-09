<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'

const props = defineProps<{
  label: string
  modelValue: string | number | undefined | null
  accept?: string
  fileExists: boolean
  disabled?: boolean
}>()

const fileInput = useTemplateRef('fileInput')

const emit = defineEmits(['update:modelValue', 'change', 'delete'])

const value = computed({
  get() {
    return props.modelValue
  },
  set(value) {
    emit('update:modelValue', value)
  },
})

function showFileSelect() {
  const clickEvent = new MouseEvent('click', {
    view: window,
    bubbles: true,
    cancelable: false,
  })
  fileInput.value?.dispatchEvent(clickEvent)
}

function handleFileChange() {
  const file = fileInput.value?.files?.[0]
  if (!file) return
  emit('change', file)
  value.value = file.name
}

function handleDeleteClick() {
  emit('delete')
}
</script>

<template>
  <div
    class="cwa:flex cwa:relative cwa:items-center cwa:select-none"
    :class="{ 'cwa:opacity-50 cwa:pointer-events-none': disabled }"
  >
    <div class="cwa:flex cwa:items-center cwa:relative">
      <input
        ref="fileInput"
        :accept="accept"
        class="cwa:absolute cwa:h-full cwa:w-full cwa:top-0 cwa:left-0 cwa:opacity-0 cwa:outline-0"
        type="file"
        @change="handleFileChange"
      >
      <CwaUiFormButton @click="showFileSelect">
        {{ label }}
      </CwaUiFormButton>
      <span class="cwa:ml-3 cwa:text-sm cwa:cursor-pointer cwa:font-medium">
        {{ value || 'No file' }}
      </span>
    </div>
    <span
      v-if="fileExists"
      class="cwa:ml-4"
    >
      <CwaUiFormButton
        color="grey"
        button-class="cwa:min-w-[100px]"
        @click="handleDeleteClick"
      >
        Remove File
      </CwaUiFormButton>
    </span>
  </div>
</template>
