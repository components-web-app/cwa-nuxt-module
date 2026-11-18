<script setup lang="ts">
import { PopoverArrow, PopoverClose, PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import StateGlyph from './StateGlyph.vue'
import XMarkIcon from '../../ui/icon/XMarkIcon.vue'

const { label, text, textId } = defineProps<{
  label: string
  text: string
  textId: string
}>()
</script>

<template>
  <PopoverRoot>
    <PopoverTrigger
      :aria-label="`About ${label}`"
      data-testid="field-info"
      class="cwa:grid cwa:size-6 cwa:shrink-0 cwa:cursor-pointer cwa:place-items-center cwa:outline-none cwa:focus-visible:outline-2 cwa:focus-visible:outline-accent-fg cwa:pointer-coarse:size-hit"
    >
      <StateGlyph kind="info" />
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent
        side="top"
        :side-offset="8"
        :collision-padding="8"
        :aria-label="label"
        data-testid="field-info-popover"
        class="cwa:z-context cwa:w-max cwa:max-w-[min(20rem,calc(100vw-1rem))] cwa:bg-surface-menu cwa:p-popover cwa:text-control cwa:text-fg cwa:shadow-popover cwa:outline-none"
      >
        <div class="cwa:-mt-1 cwa:-mr-2 cwa:mb-1.5 cwa:flex cwa:min-h-8 cwa:items-center cwa:gap-2 cwa:font-semibold">
          <span class="cwa:min-w-0 cwa:flex-1">{{ label }}</span>
          <PopoverClose
            aria-label="Close"
            class="cwa:grid cwa:size-8 cwa:shrink-0 cwa:cursor-pointer cwa:place-items-center cwa:text-fg-muted cwa:hover:bg-button cwa:hover:text-fg"
          >
            <XMarkIcon class="cwa:size-4" />
          </PopoverClose>
        </div>
        <p class="cwa:m-0">
          {{ text }}
        </p>
        <PopoverArrow
          :width="12"
          :height="6"
          class="cwa:fill-surface-menu"
        />
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
  <span
    :id="textId"
    class="cwa:sr-only"
  >{{ text }}</span>
</template>
