<script setup lang="ts">
import { PopoverArrow, PopoverClose, PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { infoArrow, infoPanel } from './field-looks'
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
      class="cwa:grid cwa:size-6 cwa:shrink-0 cwa:cursor-pointer cwa:place-items-center cwa:outline-1 cwa:outline-transparent cwa:focus-visible:outline-2 cwa:focus-visible:outline-accent-fg cwa:pointer-coarse:size-hit"
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
        :class="['cwa:z-context cwa:w-max cwa:max-w-[min(20rem,calc(100vw-1rem))] cwa:p-popover cwa:text-control cwa:outline-none', infoPanel]"
      >
        <div class="cwa:-mt-1 cwa:-mr-2 cwa:mb-1.5 cwa:flex cwa:min-h-8 cwa:items-center cwa:gap-2 cwa:font-semibold">
          <StateGlyph
            kind="info"
            accent
          />
          <span class="cwa:min-w-0 cwa:flex-1">{{ label }}</span>
          <PopoverClose
            aria-label="Close"
            class="cwa:grid cwa:size-8 cwa:shrink-0 cwa:cursor-pointer cwa:place-items-center cwa:text-fg cwa:hover:bg-button"
          >
            <XMarkIcon class="cwa:size-3" />
          </PopoverClose>
        </div>
        <p class="cwa:m-0">
          {{ text }}
        </p>
        <PopoverArrow
          :width="14"
          :height="7"
          :class="infoArrow"
        />
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
  <span
    :id="textId"
    class="cwa:sr-only"
  >{{ text }}</span>
</template>
