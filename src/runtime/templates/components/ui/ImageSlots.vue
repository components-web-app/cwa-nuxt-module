<script setup lang="ts">
import CwaUiFileUpload from './FileUpload.vue'
import type { CwaUploadField } from './FileUpload.vue'

const { label, slots, accept = 'image/*' } = defineProps<{
  label: string
  slots: { label: string, field?: string, upload?: CwaUploadField }[]
  accept?: string
}>()
</script>

<template>
  <span
    role="group"
    :aria-label="label"
    data-testid="image-slots"
    class="cwa:flex cwa:shrink-0 cwa:items-center cwa:gap-row-gap"
  >
    <template
      v-for="(slot, index) in slots"
      :key="slot.field ?? slot.label"
    >
      <span
        v-if="index > 0"
        aria-hidden="true"
        data-testid="image-slots-divider"
        class="cwa:h-6 cwa:w-px cwa:shrink-0 cwa:bg-line"
      />
      <CwaUiFileUpload
        :label="slot.label"
        :field="slot.field"
        :upload="slot.upload"
        :accept="accept"
      />
    </template>
  </span>
</template>
