<script setup lang="ts">
import { Switch, SwitchGroup, SwitchLabel } from '@headlessui/vue'
import { computed } from 'vue'

const emit = defineEmits(['update:modelValue'])
const { modelValue, disabled = false } = defineProps<{
  label: string
  modelValue: boolean | undefined | null
  disabled?: boolean
}>()

const valueAsBoolean = computed<boolean>({
  get() {
    return !!modelValue
  },
  set(value) {
    handleSwitchInput(value)
  },
})

function handleSwitchInput(newValue: boolean) {
  emit('update:modelValue', newValue)
}
</script>

<template>
  <SwitchGroup
    as="div"
    class="cwa:flex cwa:items-center"
  >
    <Switch
      :model-value="valueAsBoolean"
      :disabled="disabled"
      :class="[
        modelValue ? 'cwa:bg-indigo-600' : 'cwa:bg-gray-200', disabled ? 'cwa:opacity-50 cwa:cursor-not-allowed' : 'cwa:cursor-pointer', 'cwa:relative cwa:inline-flex cwa:h-6 cwa:w-11 cwa:shrink-0 cwa:border-2 cwa:border-transparent cwa:transition-colors cwa:duration-200 cwa:ease-in-out cwa:rounded-full',
      ]"
      @update:model-value="handleSwitchInput"
    >
      <span
        aria-hidden="true"
        :class="[modelValue ? 'cwa:translate-x-5' : 'cwa:translate-x-0', 'cwa:pointer-events-none cwa:inline-block cwa:h-5 cwa:w-5 cwa:transform cwa:bg-white cwa:shadow cwa:ring-0 cwa:transition cwa:duration-200 cwa:ease-in-out cwa:rounded-full']"
      />
    </Switch>

    <SwitchLabel
      as="span"
      class="cwa:ml-3 cwa:text-sm"
      :class="disabled ? 'cwa:opacity-50 cwa:cursor-not-allowed' : 'cwa:cursor-pointer'"
    >
      <span class="cwa:font-medium">{{ label }}</span>
    </SwitchLabel>
  </SwitchGroup>
</template>
