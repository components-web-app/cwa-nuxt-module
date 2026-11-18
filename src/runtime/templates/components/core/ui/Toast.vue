<script setup lang="ts">
import Button from '../../ui/Button.vue'
import XMarkIcon from '../../ui/icon/XMarkIcon.vue'
import type { CwaToastTone } from '#cwa/admin/toaster'

const { tone, title, description, actions = [] } = defineProps<{
  tone: CwaToastTone
  title: string
  description?: string
  actions?: { label: string, primary?: boolean }[]
}>()

defineEmits<{
  dismiss: []
  action: [index: number]
}>()

const glyphs: Record<CwaToastTone, string> = {
  success: 'M8 .5a7.5 7.5 0 1 1 0 15 7.5 7.5 0 0 1 0-15Zm-3.8 7.7L5.5 7 7 8.5 10.6 5l1.3 1.2L7 11 4.2 8.2Z',
  info: 'M8 .5a7.5 7.5 0 1 1 0 15 7.5 7.5 0 0 1 0-15ZM7.1 6.8h1.8v5.4H7.1V6.8Zm0-3h1.8v1.8H7.1V3.8Z',
  warning: 'M8 .4 15.6 8 8 15.6.4 8 8 .4Zm-.9 3.8h1.8v4.6H7.1V4.2Zm0 5.8h1.8v1.8H7.1V10Z',
  error: 'M8 .9 15.6 14.7H.4L8 .9Zm-.9 4.8h1.8v4.6H7.1V5.7Zm0 5.9h1.8v1.8H7.1v-1.8Z',
}
</script>

<template>
  <div
    class="cwa:toast cwa:grid cwa:grid-cols-[1rem_1fr_auto] cwa:gap-x-3 cwa:gap-y-1 cwa:p-popover cwa:text-control cwa:text-fg"
    :class="`cwa:toast-${tone}`"
  >
    <svg
      data-testid="toast-glyph"
      :data-tone="tone"
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 16 16"
      class="cwa:toast-glyph cwa:mt-0.5 cwa:size-4 cwa:fill-current"
    >
      <path
        fill-rule="evenodd"
        :d="glyphs[tone]"
      />
    </svg>
    <p
      data-testid="toast-title"
      class="cwa:m-0 cwa:font-semibold"
    >
      {{ title }}
    </p>
    <Button
      label="Dismiss"
      variant="ghost"
      size="sm"
      :icon="XMarkIcon"
      icon-only
      class="cwa:col-start-3 cwa:row-start-1 cwa:-mt-2 cwa:-mr-2"
      @click="$emit('dismiss')"
    />
    <p
      v-if="description"
      data-testid="toast-description"
      class="cwa:col-start-2 cwa:m-0 cwa:whitespace-pre-line"
    >
      {{ description }}
    </p>
    <div
      v-if="actions.length"
      data-testid="toast-actions"
      class="cwa:col-start-2 cwa:mt-2 cwa:flex cwa:flex-wrap cwa:gap-2"
    >
      <Button
        v-for="(action, index) in actions"
        :key="index"
        :label="action.label"
        :variant="action.primary ? 'solid' : 'soft'"
        size="sm"
        @click="$emit('action', index)"
      />
    </div>
  </div>
</template>
