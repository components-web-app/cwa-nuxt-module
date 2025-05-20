<template>
  <div>
    <label
      :for="id"
      class="cwa:block cwa:text-sm cwa:font-medium cwa:leading-6 cwa:text-neutral-300"
    >{{ props.label }}</label>
    <div class="cwa:mt-2">
      <input
        :id="id"
        :name="props.name"
        :type="props.type"
        :autocomplete="props.autocomplete"
        :required="props.required"
        :value="modelValue"
        class="cwa:block cwa:w-full cwa:border-0 cwa:py-1.5 cwa:text-neutral-900 cwa:shadow-sm cwa:ring-1 cwa:ring-inset cwa:ring-neutral-300 cwa:placeholder:text-neutral-400 cwa:focus:ring-2 cwa:focus:ring-inset cwa:focus:ring-neutral-600 cwa:sm:text-sm cwa:sm:leading-6"
        @input="updateModelValue"
      >
      <div v-if="errors">
        <CwaUiAlertWarning
          v-for="(error, index) in errors"
          :key="`error-${id}-${index}`"
          class="cwa:mt-2"
        >
          {{ error }}
        </CwaUiAlertWarning>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useId } from 'vue'

const emit = defineEmits(['update:modelValue'])

const props = withDefaults(defineProps<{
  name: string
  type?: string
  label: string
  autocomplete?: string
  required?: boolean
  modelValue: string
  errors?: string[]
}>(), {
  type: 'text',
  autocomplete: undefined,
  required: false,
  modelValue: '',
  errors: undefined,
})

const id = useId()

function updateModelValue($event: Event) {
  if (!($event.target instanceof HTMLInputElement)) {
    return
  }
  emit('update:modelValue', $event.target?.value)
}
</script>
