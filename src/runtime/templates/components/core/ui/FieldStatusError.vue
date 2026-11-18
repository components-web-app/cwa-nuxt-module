<script setup lang="ts">
import { useTemplateRef } from 'vue'
import CwaUiButton from '../../ui/Button.vue'

const { message } = defineProps<{
  message?: string
}>()

const emit = defineEmits<{ retry: [], reset: [] }>()

const actions = useTemplateRef<HTMLElement>('actions')

function focusRetry() {
  actions.value?.querySelector<HTMLElement>('button')?.focus({ preventScroll: true })
}

defineExpose({ focusRetry })
</script>

<template>
  <p class="cwa:m-0">
    {{ message || 'The server couldn’t save this.' }} Reset puts back the last saved value.
  </p>
  <div
    ref="actions"
    class="cwa:mt-4 cwa:flex cwa:flex-wrap cwa:justify-end cwa:gap-actions"
  >
    <CwaUiButton
      label="Retry"
      variant="solid"
      size="sm"
      data-testid="field-status-retry"
      @click="emit('retry')"
    />
    <CwaUiButton
      label="Reset"
      size="sm"
      data-testid="field-status-reset"
      @click="emit('reset')"
    />
  </div>
</template>
