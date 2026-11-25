<script setup lang="ts">
import { controlFor } from '../core/ui/field-descriptors'
import type { CwaFieldDescriptor } from '../core/ui/field-descriptors'
import CwaUiInput from './Input.vue'
import CwaUiNumber from './Number.vue'
import CwaUiSecretInput from './SecretInput.vue'
import CwaUiTextarea from './Textarea.vue'
import CwaUiToggle from './Toggle.vue'

const { fields, path, disabled = false } = defineProps<{
  fields: CwaFieldDescriptor[]
  path?: string
  disabled?: boolean
}>()

function fieldOf(descriptor: CwaFieldDescriptor) {
  return path ? `${path}.${descriptor.name}` : descriptor.name
}
</script>

<template>
  <template
    v-for="descriptor in fields"
    :key="descriptor.name"
  >
    <CwaUiSecretInput
      v-if="controlFor(descriptor) === 'secret'"
      :label="descriptor.label"
      :field="fieldOf(descriptor)"
      :disabled="disabled"
      :required="!!descriptor.required"
      :optional="!descriptor.required"
    />
    <CwaUiToggle
      v-else-if="controlFor(descriptor) === 'toggle'"
      :label="descriptor.label"
      :field="fieldOf(descriptor)"
      :disabled="disabled"
    />
    <CwaUiNumber
      v-else-if="controlFor(descriptor) === 'number'"
      :label="descriptor.label"
      :field="fieldOf(descriptor)"
      :disabled="disabled"
      :optional="!descriptor.required"
    />
    <CwaUiTextarea
      v-else-if="controlFor(descriptor) === 'textarea'"
      :label="descriptor.label"
      :field="fieldOf(descriptor)"
      :disabled="disabled"
      :optional="!descriptor.required"
    />
    <CwaUiInput
      v-else
      :label="descriptor.label"
      :field="fieldOf(descriptor)"
      :disabled="disabled"
      :optional="!descriptor.required"
    />
  </template>
</template>
