<script setup lang="ts">
import { computed, getCurrentInstance, nextTick, onBeforeUnmount, ref, useTemplateRef, watch } from 'vue'
import { DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'

defineOptions({ inheritAttrs: false })

const { label, closeLabel = 'Close', search = false, panelId, returnTo, testId = 'sheet' } = defineProps<{
  label: string
  closeLabel?: string
  search?: boolean
  panelId?: string
  returnTo?: HTMLElement | null
  testId?: string
}>()

const open = defineModel<boolean>('open', { required: true })

defineSlots<{
  header?: () => any
  default?: () => any
}>()

const app = getCurrentInstance()?.appContext.app as { _container?: unknown } | undefined
const content = useTemplateRef<{ $el: HTMLElement } | null>('content')
const viewport = ref<{ bottom: number, height: number, layout: number }>()
let behind: HTMLElement | undefined

function measure() {
  const visual = window.visualViewport
  if (!visual) {
    return
  }
  viewport.value = { bottom: Math.max(0, window.innerHeight - visual.height - visual.offsetTop), height: visual.height, layout: window.innerHeight }
}

const fit = computed(() => {
  if (!viewport.value) {
    return undefined
  }
  const { bottom, height, layout } = viewport.value
  const room = height - 16
  return {
    bottom: `${bottom}px`,
    maxHeight: `${Math.min(layout * 0.7, room)}px`,
    height: search ? `${Math.min(layout * 0.6, room)}px` : undefined,
  }
})

let holding = false

function hold() {
  holding = true
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
</script>

<template>
  <DialogRoot v-model:open="open">
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
        :class="{ 'cwa:h-[60vh]': search }"
        :style="fit"
        v-bind="$attrs"
        @open-auto-focus="focusFirst"
        @close-auto-focus.prevent
      >
        <div
          :id="panelId"
          class="cwa:flex cwa:min-h-0 cwa:flex-1 cwa:flex-col"
        >
          <div class="cwa:shrink-0 cwa:shadow-[inset_0_-1px_0_var(--cwa-color-line)]">
            <div
              aria-hidden="true"
              :data-testid="`${testId}-handle`"
              class="cwa:mx-auto cwa:mt-2 cwa:h-1 cwa:w-10 cwa:bg-line-strong"
            />
            <div class="cwa:flex cwa:min-h-11 cwa:items-center cwa:justify-between cwa:gap-2 cwa:pl-4">
              <DialogTitle class="cwa:min-w-0 cwa:truncate cwa:text-label cwa:font-semibold cwa:text-fg">
                {{ label }}
              </DialogTitle>
              <button
                type="button"
                :data-testid="`${testId}-close`"
                class="cwa:min-h-11 cwa:shrink-0 cwa:cursor-pointer cwa:px-4 cwa:text-label cwa:text-fg cwa:outline-1 cwa:outline-transparent cwa:hover:bg-field-hover cwa:focus-visible:outline-2 cwa:focus-visible:-outline-offset-2 cwa:focus-visible:outline-accent-fg"
                @click="open = false"
              >
                {{ closeLabel }}
              </button>
            </div>
          </div>
          <slot name="header" />
          <div class="cwa:min-h-0 cwa:flex-1 cwa:overflow-y-auto cwa:overscroll-contain">
            <slot />
          </div>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
