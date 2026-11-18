<script setup lang="ts">
import { ref, useId, useTemplateRef } from 'vue'
import { PopoverArrow, PopoverContent, PopoverPortal, PopoverRoot } from 'reka-ui'
import { infoArrow, infoPanel } from '../core/ui/field-looks'
import { POPOVER_GAP } from '../core/ui/popover-gap'

const { label, info } = defineProps<{
  label: string
  info?: string
}>()

const labelId = useId()
const infoId = useId()
const cue = useTemplateRef<HTMLElement>('cue')
const open = ref(false)
const HIDE_DELAY_MS = 150
let hiding: ReturnType<typeof setTimeout> | undefined

function show() {
  clearTimeout(hiding)
  open.value = true
}

function hideSoon() {
  clearTimeout(hiding)
  hiding = setTimeout(() => {
    open.value = false
  }, HIDE_DELAY_MS)
}

function hide() {
  clearTimeout(hiding)
  open.value = false
}

function onPointerenter(event: PointerEvent) {
  event.pointerType === 'mouse' && show()
}

function onPointerleave(event: PointerEvent) {
  event.pointerType === 'mouse' && hideSoon()
}

function onFocusin(event: FocusEvent) {
  (event.target as HTMLElement).matches?.(':focus-visible') !== false && show()
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && open.value) {
    event.stopPropagation()
    hide()
  }
}
</script>

<template>
  <div
    role="group"
    :aria-labelledby="labelId"
    :aria-describedby="info ? infoId : undefined"
    data-testid="edit-placeholder"
    class="cwa:flex cwa:min-h-16 cwa:flex-col cwa:items-center cwa:justify-center cwa:gap-2 cwa:border cwa:border-line cwa:bg-surface cwa:p-4 cwa:text-center cwa:text-label cwa:text-fg-muted"
  >
    <span
      :id="labelId"
      class="cwa:sr-only"
    >{{ label }}</span>
    <span
      v-if="info"
      :id="infoId"
      class="cwa:sr-only"
    >{{ info }}</span>
    <span
      ref="cue"
      data-testid="edit-placeholder-cue"
      class="cwa:inline-flex"
      @pointerenter="onPointerenter"
      @pointerleave="onPointerleave"
      @focusin="onFocusin"
      @focusout="hide"
      @keydown="onKeydown"
    >
      <slot :described-by="info ? infoId : undefined" />
    </span>
    <PopoverRoot
      v-if="info"
      :open="open"
      @update:open="next => next ? show() : hide()"
    >
      <PopoverPortal>
        <PopoverContent
          :reference="cue ?? undefined"
          side="top"
          :side-offset="POPOVER_GAP"
          :collision-padding="8"
          aria-hidden="true"
          data-testid="edit-placeholder-tooltip"
          :class="['cwa:z-context cwa:w-max cwa:max-w-[min(20rem,calc(100vw-1rem))] cwa:p-popover cwa:text-control cwa:outline-none', infoPanel]"
          @open-auto-focus.prevent
          @close-auto-focus.prevent
          @pointerenter="onPointerenter"
          @pointerleave="onPointerleave"
        >
          <p class="cwa:m-0 cwa:trim-text">
            {{ info }}
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
  </div>
</template>
