<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, useId, useTemplateRef, watch } from 'vue'

const { open, title = '', backLabel, initialFocus, returnFocus, padded = false } = defineProps<{
  open: boolean
  padded?: boolean
  title?: string
  backLabel: string
  initialFocus?: () => HTMLElement | null | undefined
  returnFocus?: () => HTMLElement | null | undefined
}>()

const emit = defineEmits<{ back: [] }>()

defineSlots<{
  'main'?: () => any
  'lead'?: () => any
  'title-after'?: () => any
  'default'?: () => any
}>()

const titleId = useId()
const root = useTemplateRef<HTMLElement>('root')
const heading = useTemplateRef<HTMLElement>('heading')
const returned = ref(false)

let opener: HTMLElement | null = null
let scrollTop = 0
let keyScope: HTMLElement | null = null

function listen(on: boolean) {
  keyScope?.removeEventListener('keydown', onKeydown)
  keyScope = on ? root.value?.closest<HTMLElement>('[role="dialog"]') ?? root.value : null
  keyScope?.addEventListener('keydown', onKeydown)
}

onBeforeUnmount(() => listen(false))

function scroller() {
  return root.value?.closest<HTMLElement>('[data-cwa-scroll]') ?? null
}

watch(() => open, async (isOpen, wasOpen) => {
  const container = scroller()
  listen(isOpen)
  if (isOpen) {
    opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    scrollTop = container?.scrollTop ?? 0
    returned.value = false
    await nextTick()
    container && (container.scrollTop = 0)
    ;(initialFocus?.() ?? heading.value)?.focus({ preventScroll: true })
    return
  }
  if (!wasOpen) {
    return
  }
  returned.value = true
  await nextTick()
  container && (container.scrollTop = scrollTop)
  const target = returnFocus?.() ?? (opener?.isConnected ? opener : null)
  target?.focus({ preventScroll: true })
  opener = null
})

function layerAbove() {
  const scope = keyScope
  return !!scope && [...document.querySelectorAll<HTMLElement>('[data-dismissable-layer]')].some(layer => layer !== scope
    && !layer.closest('[hidden]')
    && !!(scope.compareDocumentPosition(layer) & Node.DOCUMENT_POSITION_FOLLOWING))
}

function editable(target: EventTarget | null) {
  return !!(target as Element | null)?.closest?.('input, textarea, [contenteditable]:not([contenteditable="false"])')
}

function onKeydown(event: KeyboardEvent) {
  if (event.defaultPrevented) {
    return
  }
  if ((event.target as Element | null)?.closest?.('[aria-expanded="true"]') || layerAbove()) {
    return
  }
  if (event.key === 'Escape' || (event.altKey && event.key === 'ArrowLeft' && !editable(event.target))) {
    event.preventDefault()
    event.stopPropagation()
    emit('back')
  }
}
</script>

<template>
  <div
    ref="root"
    data-testid="sub-view-root"
  >
    <div
      :hidden="open || undefined"
      :inert="open || undefined"
      data-testid="sub-view-main"
      :class="{ 'cwa:motion-safe:animate-[cwa-sub-view-back_var(--cwa-duration-base)_ease]': returned }"
    >
      <slot name="main" />
    </div>
    <div
      v-if="open"
      role="group"
      :aria-labelledby="titleId"
      data-testid="sub-view"
      class="cwa:motion-safe:animate-[cwa-sub-view-in_var(--cwa-duration-base)_ease]"
    >
      <div
        data-testid="sub-view-header"
        data-cwa-sticky
        class="cwa:sticky cwa:z-1 cwa:border-b cwa:border-line cwa:bg-surface cwa:px-6 cwa:pt-3 cwa:pb-4"
        :class="padded ? 'cwa:-mx-6 cwa:-mt-6 cwa:mb-6 cwa:-top-6' : 'cwa:top-0 cwa:max-sm:px-4'"
      >
        <button
          type="button"
          :aria-label="`Back to ${backLabel}`"
          data-testid="sub-view-back"
          class="cwa:-ms-1 cwa:inline-flex cwa:h-target cwa:cursor-pointer cwa:items-center cwa:gap-1 cwa:px-1 cwa:text-label cwa:text-fg-muted cwa:outline-1 cwa:outline-transparent cwa:transition-colors cwa:duration-(--cwa-duration-fast) cwa:hover:text-fg cwa:focus-visible:outline-2 cwa:focus-visible:outline-accent-fg cwa:pointer-coarse:h-hit"
          @click="emit('back')"
        >
          <svg
            viewBox="0 0 6 10"
            aria-hidden="true"
            class="cwa:h-2.5 cwa:w-1.5 cwa:shrink-0 cwa:fill-current"
          ><path d="M6 0v10L0 5z" /></svg>
          {{ backLabel }}
        </button>
        <div class="cwa:mt-2 cwa:flex cwa:items-center cwa:gap-3">
          <slot name="lead" />
          <h3
            :id="titleId"
            ref="heading"
            tabindex="-1"
            data-testid="sub-view-title"
            class="cwa:m-0 cwa:text-section cwa:text-fg cwa:outline-none"
          >
            {{ title }}
          </h3>
          <slot name="title-after" />
        </div>
      </div>
      <slot />
    </div>
  </div>
</template>
