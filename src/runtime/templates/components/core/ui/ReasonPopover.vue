<script setup lang="ts">
import { POPOVER_GAP } from './popover-gap'
import { onMounted } from 'vue'
import { PopoverAnchor, PopoverArrow, PopoverContent, PopoverPortal, PopoverRoot } from 'reka-ui'
import { useAnnounce } from './field-context'
import { infoArrow, infoPopover } from './field-looks'

const { anchor, label, text } = defineProps<{
  anchor: HTMLElement
  label: string
  text: string
}>()

const emit = defineEmits<{ close: [] }>()

const announce = useAnnounce()
onMounted(() => announce(text))
</script>

<template>
  <PopoverRoot
    :open="true"
    @update:open="open => open || emit('close')"
  >
    <PopoverAnchor :reference="anchor" />
    <PopoverPortal>
      <PopoverContent
        side="top"
        :side-offset="POPOVER_GAP"
        :collision-padding="8"
        :aria-label="label"
        data-testid="button-reason"
        :class="infoPopover"
        @open-auto-focus.prevent
        @close-auto-focus.prevent
      >
        <p class="cwa:m-0 cwa:trim-text">
          {{ text }}
        </p>
        <PopoverArrow
          :width="14"
          :height="7"
          :class="infoArrow"
        >
          <path
            d="M0 0L6 6L12 0"
            vector-effect="non-scaling-stroke"
          />
        </PopoverArrow>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
