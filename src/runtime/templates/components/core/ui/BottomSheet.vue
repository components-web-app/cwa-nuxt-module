<script setup lang="ts">
import { computed, getCurrentInstance, nextTick, onBeforeUnmount, ref, useTemplateRef, watch } from 'vue'
import { DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'
import CheckGlyph from './CheckGlyph.vue'
import XMarkIcon from '../../ui/icon/XMarkIcon.vue'
import { prefersReducedMotion } from './sheet-media'

defineOptions({ inheritAttrs: false })

const { label, actions = false, search = false, panelId, returnTo, testId = 'sheet' } = defineProps<{
  label: string
  actions?: boolean
  search?: boolean
  panelId?: string
  returnTo?: HTMLElement | null
  testId?: string
}>()

const open = defineModel<boolean>('open', { required: true })

const emit = defineEmits<{
  apply: []
  discard: []
}>()

defineSlots<{
  header?: () => any
  default?: () => any
}>()

const SLOP = 6
const SLIDE = 220
const FLICK = 0.5

const app = getCurrentInstance()?.appContext.app as { _container?: unknown } | undefined
const content = useTemplateRef<{ $el: HTMLElement } | null>('content')
const viewport = ref<{ bottom: number, height: number, layout: number }>()
const offset = ref<number>()
const dragging = ref(false)
const sliding = ref(false)
const atTop = ref(true)
let behind: HTMLElement | undefined
let gesture: { id: number, startY: number, lastY: number, lastAt: number, velocity: number } | undefined
let swallowClick = false
let finished = false
let timer: ReturnType<typeof setTimeout> | undefined

function measure() {
  const visual = window.visualViewport
  if (!visual) {
    return
  }
  viewport.value = { bottom: Math.max(0, window.innerHeight - visual.height - visual.offsetTop), height: visual.height, layout: window.innerHeight }
}

const fit = computed(() => {
  const moved = offset.value === undefined ? {} : { translate: `0px ${offset.value}px` }
  if (!viewport.value) {
    return moved
  }
  const { bottom, height, layout } = viewport.value
  const room = height - 16
  return {
    ...moved,
    bottom: `${bottom}px`,
    maxHeight: `${Math.min(layout * 0.7, room)}px`,
    height: search ? `${Math.min(layout * 0.6, room)}px` : undefined,
  }
})

let holding = false

function hold() {
  holding = true
  finished = false
  nextTick(() => {
    const container = app?._container
    if (holding && container instanceof HTMLElement && !container.hasAttribute('inert')) {
      behind = container
      container.setAttribute('inert', '')
    }
  })
  measure()
  window.visualViewport?.addEventListener('resize', measure)
  window.visualViewport?.addEventListener('scroll', measure)
}

function release() {
  window.visualViewport?.removeEventListener('resize', measure)
  window.visualViewport?.removeEventListener('scroll', measure)
  clearTimeout(timer)
  if (!holding) {
    return
  }
  holding = false
  behind?.removeAttribute('inert')
  behind = undefined
  const target = returnTo
  nextTick(() => target?.isConnected && target.focus({ preventScroll: true }))
}

watch(open, isOpen => isOpen ? hold() : release(), { immediate: true })
onBeforeUnmount(release)

function finish(how: 'apply' | 'discard') {
  if (finished) {
    return
  }
  finished = true
  if (actions) {
    if (how === 'apply') {
      emit('apply')
    }
    else {
      emit('discard')
    }
  }
  open.value = false
}

function onOpenChange(next: boolean) {
  !next && finish('discard')
}

function focusFirst(event: Event) {
  event.preventDefault()
  const panel = content.value?.$el
  const target = panel?.querySelector?.<HTMLElement>('[data-sheet-focus]') ?? panel
  target?.focus({ preventScroll: true })
  target instanceof HTMLInputElement && nextTick(() => {
    const end = target.value.length
    target.setSelectionRange(end, end)
  })
}

function onScroll(event: Event) {
  atTop.value = (event.target as HTMLElement).scrollTop <= 0
}

function start(event: PointerEvent, fromBody: boolean) {
  swallowClick = false
  if (!event.isPrimary || event.button !== 0 || finished || (fromBody && !atTop.value)) {
    return
  }
  gesture = { id: event.pointerId, startY: event.clientY, lastY: event.clientY, lastAt: performance.now(), velocity: 0 }
}

function begin() {
  dragging.value = true
  sliding.value = false
  clearTimeout(timer)
  content.value?.$el.setPointerCapture?.(gesture!.id)
}

function move(event: PointerEvent) {
  if (!gesture || event.pointerId !== gesture.id) {
    return
  }
  const distance = event.clientY - gesture.startY
  if (!dragging.value) {
    if (distance < -SLOP) {
      gesture = undefined
      return
    }
    if (distance <= SLOP) {
      return
    }
    begin()
  }
  const at = performance.now()
  gesture.velocity = at > gesture.lastAt ? (event.clientY - gesture.lastY) / (at - gesture.lastAt) : gesture.velocity
  gesture.lastY = event.clientY
  gesture.lastAt = at
  offset.value = Math.max(0, distance)
}

function slide(to: number, then?: () => void) {
  sliding.value = true
  offset.value = to
  timer = setTimeout(() => then?.(), SLIDE)
}

function end(event: PointerEvent) {
  if (!gesture || event.pointerId !== gesture.id) {
    return
  }
  const { velocity } = gesture
  gesture = undefined
  if (!dragging.value) {
    return
  }
  dragging.value = false
  const moved = offset.value ?? 0
  swallowClick = moved > SLOP
  const height = content.value?.$el.getBoundingClientRect().height ?? 0
  if (event.type === 'pointerup' && (moved > Math.max(80, height * 0.25) || velocity > FLICK)) {
    if (prefersReducedMotion()) {
      finish('apply')
      return
    }
    slide(height || window.innerHeight, () => finish('apply'))
    return
  }
  if (prefersReducedMotion()) {
    offset.value = 0
    return
  }
  slide(0)
}

function onClickCapture(event: MouseEvent) {
  if (swallowClick) {
    swallowClick = false
    event.preventDefault()
    event.stopPropagation()
  }
}

const motion = computed(() => sliding.value && !dragging.value ? 'cwa:transition-[translate] cwa:duration-(--cwa-duration-base) cwa:ease-out' : '')
const sideButton = 'cwa:grid cwa:size-hit cwa:shrink-0 cwa:cursor-pointer cwa:place-items-center cwa:text-fg cwa:outline-1 cwa:outline-transparent cwa:hover:bg-field-hover cwa:focus-visible:outline-2 cwa:focus-visible:-outline-offset-2 cwa:focus-visible:outline-accent-fg'
</script>

<template>
  <DialogRoot
    :open="open"
    @update:open="onOpenChange"
  >
    <DialogPortal>
      <DialogOverlay
        :data-testid="`${testId}-scrim`"
        class="cwa:fixed cwa:inset-0 cwa:z-context cwa:bg-black/40 cwa:motion-safe:animate-[cwa-line-in_var(--cwa-duration-base)_ease-out]"
      />
      <DialogContent
        ref="content"
        aria-modal="true"
        :aria-describedby="undefined"
        :data-testid="testId"
        class="cwa:fixed cwa:inset-x-0 cwa:bottom-0 cwa:z-context cwa:flex cwa:max-h-[70vh] cwa:flex-col cwa:bg-surface-menu cwa:pb-[env(safe-area-inset-bottom)] cwa:text-control cwa:text-fg cwa:shadow-popover cwa:outline-1 cwa:outline-transparent cwa:motion-safe:animate-[cwa-sheet-in_var(--cwa-duration-base)_cubic-bezier(0.2,0.8,0.2,1)]"
        :class="[{ 'cwa:h-[60vh]': search }, motion]"
        :style="fit"
        v-bind="$attrs"
        @open-auto-focus="focusFirst"
        @close-auto-focus.prevent
        @pointermove="move"
        @pointerup="end"
        @pointercancel="end"
        @click.capture="onClickCapture"
      >
        <div
          :id="panelId"
          class="cwa:flex cwa:min-h-0 cwa:flex-1 cwa:flex-col"
        >
          <div class="cwa:shrink-0 cwa:shadow-[inset_0_-1px_0_var(--cwa-color-line)]">
            <div
              :data-testid="`${testId}-grip`"
              class="cwa:touch-none cwa:select-none"
              @pointerdown="start($event, false)"
            >
              <div
                aria-hidden="true"
                :data-testid="`${testId}-handle`"
                class="cwa:mx-auto cwa:mt-2 cwa:h-1 cwa:w-10 cwa:bg-line-strong"
              />
              <div
                class="cwa:flex cwa:min-h-11 cwa:items-center cwa:gap-2"
                :class="actions ? '' : 'cwa:px-4'"
              >
                <button
                  v-if="actions"
                  type="button"
                  aria-label="Discard changes"
                  :data-testid="`${testId}-discard`"
                  :class="sideButton"
                  @click="finish('discard')"
                >
                  <XMarkIcon
                    aria-hidden="true"
                    class="cwa:size-5"
                  />
                </button>
                <DialogTitle
                  class="cwa:min-w-0 cwa:flex-1 cwa:truncate cwa:text-label cwa:font-semibold cwa:text-fg"
                  :class="{ 'cwa:text-center': actions }"
                >
                  {{ label }}
                </DialogTitle>
                <button
                  v-if="actions"
                  type="button"
                  aria-label="Apply"
                  :data-testid="`${testId}-apply`"
                  :class="sideButton"
                  @click="finish('apply')"
                >
                  <CheckGlyph class="cwa:size-4" />
                </button>
              </div>
            </div>
          </div>
          <slot name="header" />
          <div
            data-sheet-body
            class="cwa:min-h-0 cwa:flex-1 cwa:overflow-y-auto cwa:overscroll-contain"
            :class="atTop ? 'cwa:touch-pan-down' : 'cwa:touch-pan-y'"
            @scroll.passive="onScroll"
            @pointerdown="start($event, true)"
          >
            <slot />
          </div>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
