<script setup lang="ts">
import { ref } from 'vue'
import { PopoverArrow, PopoverClose, PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import StateGlyph from './StateGlyph.vue'
import XMarkIcon from '../../ui/icon/XMarkIcon.vue'

const { label, text, textId, hover = false } = defineProps<{
  label: string
  text: string
  textId: string
  hover?: boolean
}>()

const HIDE_DELAY_MS = 150
const open = ref(false)
let passive = false
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
    open.value = false
  }, HIDE_DELAY_MS))
}

function onCloseAutoFocus(event: Event) {
  passive && event.preventDefault()
  passive = false
}

function onPointerenter(event: PointerEvent) {
  hover && event.pointerType === 'mouse' && show()
}

function onPointerleave(event: PointerEvent) {
  hover && event.pointerType === 'mouse' && hideSoon()
}

function onFocus(event: FocusEvent) {
  const target = event.target as HTMLElement
  hover && !open.value && target.matches?.(':focus-visible') !== false && show()
}

function onBlur() {
  hover && hideSoon()
}

function onOpenChange(next: boolean) {
  clearTimeout(hiding)
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
      @pointerenter="onPointerenter"
      @pointerleave="onPointerleave"
      @focus="onFocus"
      @blur="onBlur"
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
        @open-auto-focus="onOpenAutoFocus"
        @close-auto-focus="onCloseAutoFocus"
        @pointerenter="onPointerenter"
        @pointerleave="onPointerleave"
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
