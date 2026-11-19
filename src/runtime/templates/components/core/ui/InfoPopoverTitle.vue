<script setup lang="ts">
import { PopoverClose } from 'reka-ui'
import { infoClose } from './field-looks'
import StateGlyph from './StateGlyph.vue'
import XMarkIcon from '../../ui/icon/XMarkIcon.vue'

const { title } = defineProps<{
  title: string
}>()
</script>

<template>
  <div class="cwa:mb-4 cwa:flex cwa:h-[1cap] cwa:items-center cwa:gap-2 cwa:font-semibold cwa:text-accent-on-info">
    <StateGlyph
      kind="info"
      inherit
    />
    <span class="cwa:min-w-0 cwa:flex-1 cwa:trim-text">{{ title }}</span>
    <PopoverClose
      aria-label="Close"
      :class="infoClose"
    >
      <XMarkIcon class="cwa:size-3" />
    </PopoverClose>
  </div>
</template>
