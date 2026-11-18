<script setup lang="ts">
import { onMounted } from 'vue'
import { PopoverAnchor, PopoverArrow, PopoverContent, PopoverPortal, PopoverRoot } from 'reka-ui'
import { useAnnounce } from './field-context'
import { infoArrow, infoPanel } from './field-looks'

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
        :side-offset="8"
        :collision-padding="8"
        :aria-label="label"
        data-testid="button-reason"
        :class="['cwa:z-context cwa:w-max cwa:max-w-[min(20rem,calc(100vw-1rem))] cwa:p-popover cwa:text-control cwa:outline-none', infoPanel]"
        @open-auto-focus.prevent
        @close-auto-focus.prevent
      >
        {{ text }}
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
