<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'
import { PopoverArrow, PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { infoArrow, infoPopover } from './field-looks'
import { POPOVER_GAP } from './popover-gap'
import StateGlyph from './StateGlyph.vue'
import InfoPopoverTitle from './InfoPopoverTitle.vue'

const { label, text, textId, hover = false } = defineProps<{
  label: string
  text: string
  textId: string
  hover?: boolean
}>()

const glyph = useTemplateRef<{ $el: Element }>('glyph')
const glyphElement = computed(() => glyph.value?.$el)

const HIDE_DELAY_MS = 150
const open = ref(false)
let passive = false
let closedPassive = false
let settledOnButton = false
let keepOpen = false
let hiding: ReturnType<typeof setTimeout> | undefined

function show() {
  clearTimeout(hiding)
  if (!open.value) {
    passive = true
    open.value = true
  }
}

function hideSoon() {
  clearTimeout(hiding)
  passive && (hiding = setTimeout(() => {
    closedPassive = true
    passive = false
    open.value = false
  }, HIDE_DELAY_MS))
}

function onCloseAutoFocus(event: Event) {
  closedPassive && event.preventDefault()
}

function onPointerenter(event: PointerEvent) {
  hover && event.pointerType === 'mouse' && show()
}

function onPointerleave(event: PointerEvent) {
  hover && event.pointerType === 'mouse' && hideSoon()
}

function onFocus(event: FocusEvent) {
  const target = event.target as HTMLElement
  hover && !open.value && !settledOnButton && target.matches?.(':focus-visible') !== false && show()
}

function onBlur() {
  settledOnButton = false
  hover && hideSoon()
}

function onClick() {
  if (hover && open.value && passive) {
    passive = false
    keepOpen = true
  }
}

function onOpenChange(next: boolean) {
  clearTimeout(hiding)
  if (!next && keepOpen) {
    keepOpen = false
    return
  }
  keepOpen = false
  closedPassive = !next && passive
  settledOnButton = !next
  passive = false
  open.value = next
}

function onOpenAutoFocus(event: Event) {
  passive && event.preventDefault()
}
</script>

<template>
  <PopoverRoot
    :open="open"
    @update:open="onOpenChange"
  >
    <PopoverTrigger
      :aria-label="`About ${label}`"
      :aria-describedby="hover ? textId : undefined"
      data-testid="field-info"
      class="cwa:grid cwa:size-6 cwa:shrink-0 cwa:cursor-pointer cwa:place-items-center cwa:text-fg-muted cwa:hover:text-fg cwa:aria-expanded:text-accent-fg cwa:outline-1 cwa:outline-transparent cwa:focus-visible:outline-2 cwa:focus-visible:outline-accent-fg cwa:pointer-coarse:size-hit"
      @pointerenter="onPointerenter"
      @pointerleave="onPointerleave"
      @focus="onFocus"
      @blur="onBlur"
      @click="onClick"
    >
      <StateGlyph
        ref="glyph"
        kind="info"
        inherit
      />
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent
        :reference="glyphElement"
        side="top"
        :side-offset="POPOVER_GAP"
        :collision-padding="8"
        :aria-label="label"
        data-testid="field-info-popover"
        :class="infoPopover"
        @open-auto-focus="onOpenAutoFocus"
        @close-auto-focus="onCloseAutoFocus"
        @pointerenter="onPointerenter"
        @pointerleave="onPointerleave"
      >
        <InfoPopoverTitle :title="label" />
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
  <span
    :id="textId"
    class="cwa:sr-only"
  >{{ text }}</span>
</template>
