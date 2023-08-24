<template>
  <SwitchGroup as="div" class="cwa-flex cwa-items-center">
    <Switch
      :model-value="modelValue"
      :class="[
        modelValue ? 'cwa-bg-indigo-600' : 'cwa-bg-gray-200', 'cwa-relative cwa-inline-flex cwa-h-6 cwa-w-11 cwa-flex-shrink-0 cwa-cursor-pointer cwa-border-2 cwa-border-transparent cwa-transition-colors cwa-duration-200 cwa-ease-in-out focus:cwa-outline-none focus:cwa-ring-2 focus:cwa-ring-indigo-600 focus:cwa-ring-offset-2'
      ]"
      @update:model-value="handleSwitchInput"
    >
      <span aria-hidden="true" :class="[modelValue ? 'cwa-translate-x-5' : 'cwa-translate-x-0', 'cwa-pointer-events-none cwa-inline-block cwa-h-5 cwa-w-5 cwa-transform cwa-bg-white cwa-shadow cwa-ring-0 cwa-transition cwa-duration-200 cwa-ease-in-out']" />
    </Switch>

    <SwitchLabel as="span" class="cwa-ml-3 cwa-text-sm">
      <span class="cwa-font-medium">{{ label }}</span>
    </SwitchLabel>
  </SwitchGroup>
</template>

<script setup lang="ts">
import { Switch, SwitchGroup, SwitchLabel } from '@headlessui/vue'

const emit = defineEmits(['update:modelValue'])
defineProps<{
  label: string,
  modelValue: boolean
}>()

function handleSwitchInput (newValue: boolean) {
  emit('update:modelValue', newValue)
}
</script>
