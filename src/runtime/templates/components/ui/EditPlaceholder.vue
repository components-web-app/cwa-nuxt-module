<script setup lang="ts">
import { useId } from 'vue'
import InfoPopover from '../core/ui/InfoPopover.vue'

const { label, info } = defineProps<{
  label: string
  info?: string
}>()

const infoId = useId()
</script>

<template>
  <div
    data-testid="edit-placeholder"
    class="cwa:flex cwa:min-h-16 cwa:flex-col cwa:items-center cwa:justify-center cwa:gap-2 cwa:border cwa:border-line cwa:bg-surface cwa:p-4 cwa:text-center cwa:text-label cwa:text-fg-muted"
  >
    <span class="cwa:flex cwa:items-center cwa:gap-1">
      <span>{{ label }}</span>
      <InfoPopover
        v-if="info"
        :label="label"
        :text="info"
        :text-id="infoId"
        hover
      />
    </span>
    <slot />
  </div>
</template>
