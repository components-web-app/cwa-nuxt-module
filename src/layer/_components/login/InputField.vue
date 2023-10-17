<template>
  <div>
    <label :for="id" class="cwa-block cwa-text-sm cwa-font-medium cwa-leading-6 cwa-text-neutral-300">{{ props.label }}</label>
    <div class="cwa-mt-2">
      <input
        :id="id"
        :name="props.name"
        :type="props.type"
        :autocomplete="props.autocomplete"
        :required="props.required"
        :value="modelValue"
        class="cwa-block cwa-w-full cwa-border-0 cwa-py-1.5 cwa-text-neutral-900 cwa-shadow-sm cwa-ring-1 cwa-ring-inset cwa-ring-neutral-300 placeholder:cwa-text-neutral-400 focus:cwa-ring-2 focus:cwa-ring-inset focus:cwa-ring-neutral-600 sm:cwa-text-sm sm:cwa-leading-6"
        @input="$emit('update:modelValue', $event.target.value)"
      >
      <div v-if="errors">
        <CwaUiAlertWarning v-for="(error, index) in errors" :key="`error-${id}-${index}`" class="cwa-mt-2">
          {{ error }}
        </CwaUiAlertWarning>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { v4 as uuidv4 } from 'uuid'
import { ref } from 'vue'

defineEmits(['update:modelValue'])

const props = withDefaults(defineProps<{
  name: string,
  type?: string,
  label: string,
  autocomplete?: string,
  required?: boolean,
  modelValue: string,
  errors?: string[]
}>(), {
  type: 'text',
  autocomplete: undefined,
  required: false,
  modelValue: '',
  errors: undefined
})

const id = ref(uuidv4())
</script>
