<script setup lang="ts">
const { modelValue, hasRoute } = defineProps<{
  modelValue: boolean | undefined | null
  hasRoute: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()
</script>

<template>
  <div class="cwa:flex cwa:flex-col cwa:gap-y-1 cwa:px-1">
    <CwaUiFormToggle
      :model-value="modelValue"
      :disabled="hasRoute"
      label="Public without a route"
      @update:model-value="emit('update:modelValue', $event)"
    />
    <span class="cwa:text-xs cwa:text-stone-400">{{ hasRoute ? 'Has no effect while this page has a route.' : 'Also needs any parent page to be live.' }}</span>
  </div>
</template>
