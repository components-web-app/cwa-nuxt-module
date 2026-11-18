<script setup lang="ts">
import XMarkIcon from '../../ui/icon/XMarkIcon.vue'
import StateGlyph from './StateGlyph.vue'
import type { GlyphKind } from './StateGlyph.vue'

const { title, glyph } = defineProps<{
  title: string
  glyph?: GlyphKind
}>()

const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <div class="cwa:mb-4 cwa:flex cwa:h-[1cap] cwa:items-center cwa:gap-2 cwa:font-semibold">
    <StateGlyph
      v-if="glyph"
      :kind="glyph"
    />
    <span class="cwa:min-w-0 cwa:flex-1 cwa:trim-text">{{ title }}</span>
    <button
      type="button"
      tabindex="-1"
      aria-label="Close"
      class="cwa:grid cwa:size-6 cwa:shrink-0 cwa:cursor-pointer cwa:place-items-center cwa:text-fg-muted cwa:hover:bg-button cwa:hover:text-fg"
      @click="emit('close')"
    >
      <XMarkIcon class="cwa:size-4" />
    </button>
  </div>
</template>
