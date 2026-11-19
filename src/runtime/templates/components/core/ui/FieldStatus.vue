<script setup lang="ts">
import { POPOVER_GAP } from './popover-gap'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { PopoverArrow, PopoverContent, PopoverRoot } from 'reka-ui'
import CwaUiButton from '../../ui/Button.vue'
import FieldStatusTitle from './FieldStatusTitle.vue'
import FieldStatusError from './FieldStatusError.vue'
import { useStatusPopover } from './status-popovers'
import type { FieldUndo } from './field-keys'
import { shownValue } from './field-value'
import type { FieldValueFormat } from './field-value'
import type { ResourceModelField } from '#cwa/resources/model-editors'
import type { CwaFieldState } from '#cwa/storage/stores/resources/state'

export type LineState = 'saving' | 'saved' | 'error' | 'conflict' | 'undo'

const SAVED_FOR = 1180
const HOVER_DELAY = 300

const { state, name, box, model, descriptionId, undo, format } = defineProps<{
  state: CwaFieldState
  name: string
  box: HTMLElement | null | undefined
  model?: ResourceModelField<any>
  descriptionId: string
  undo?: FieldUndo
  format?: FieldValueFormat
}>()

const now = ref(Date.now())
let savedTimer: ReturnType<typeof setTimeout> | undefined

watch(() => state.status === 'saved' ? state.savedAt : undefined, (savedAt) => {
  clearTimeout(savedTimer)
  now.value = Date.now()
  if (savedAt === undefined) {
    return
  }
  const left = savedAt + SAVED_FOR - now.value
  if (left > 0) {
    savedTimer = setTimeout(() => {
      now.value = Date.now()
    }, left)
  }
}, { immediate: true })

const line = computed<LineState | undefined>(() => {
  switch (state.status) {
    case 'saving':
      return 'saving'
    case 'error':
      return 'error'
    case 'conflict':
      return 'conflict'
    case 'saved':
      return undo ? 'undo' : (state.savedAt ?? 0) + SAVED_FOR > now.value ? 'saved' : undefined
    default:
      return undo && state.status === 'idle' ? 'undo' : undefined
  }
})

const hasPopover = computed(() => line.value === 'error' || line.value === 'conflict' || line.value === 'undo')

const who = computed(() => model?.remoteChange.value?.name || state.held?.user?.name || 'Someone else')

const theirs = computed(() => model?.remoteChange.value ? model.remoteChange.value.value : state.held?.value)

const yours = computed(() => model?.model.value)

const description = computed(() => {
  if (line.value === 'error') {
    return `Not saved. ${state.error?.message || 'The server couldn’t save this.'} Retry and Reset follow.`
  }
  if (line.value === 'conflict') {
    return `Changed by ${who.value} while you were editing. Use ${who.value}’s and Keep mine follow.`
  }
  if (line.value === 'undo') {
    return `Saved. ${undo?.text} Undo follows.`
  }
  return undefined
})

const title = computed(() => line.value === 'error' ? `${name}: not saved` : line.value === 'undo' ? `${name}: saved` : `${name}: changed by ${who.value}`)

const open = ref(false)
const stack = useStatusPopover()
const shown = computed(() => open.value && stack.front.value)
let dismissed = false
let hovered = false
const content = ref<{ $el?: HTMLElement } | null>(null)
let hoverTimer: ReturnType<typeof setTimeout> | undefined
let closeTimer: ReturnType<typeof setTimeout> | undefined
let lastFocused: HTMLElement | undefined

function popoverEl(): HTMLElement | undefined {
  return content.value?.$el
}

function within(target: EventTarget | null | undefined) {
  const node = target as Node | null | undefined
  return !!node && (!!box?.contains(node) || !!popoverEl()?.contains(node))
}

function show() {
  clearTimeout(closeTimer)
  clearTimeout(hoverTimer)
  if (hasPopover.value && !dismissed) {
    open.value = true
  }
}

function hide() {
  clearTimeout(hoverTimer)
  clearTimeout(closeTimer)
  open.value = false
}

function dismiss() {
  hide()
  dismissed = true
}

watch(open, (isOpen) => {
  isOpen ? stack.claim() : stack.release()
})

function scheduleClose() {
  clearTimeout(closeTimer)
  closeTimer = setTimeout(() => {
    if (!within(document.activeElement) && !popoverEl()?.matches(':hover')) {
      open.value = false
    }
  }, HOVER_DELAY)
}

function onFocusin(event: FocusEvent) {
  const target = event.target as HTMLElement
  if (!popoverEl()?.contains(target)) {
    lastFocused = target
  }
  show()
}

function onFocusout(event: FocusEvent) {
  if (!within(event.relatedTarget)) {
    hide()
    dismissed &&= hovered
  }
}

function onMouseenter() {
  hovered = true
  clearTimeout(closeTimer)
  clearTimeout(hoverTimer)
  hoverTimer = setTimeout(show, HOVER_DELAY)
}

function onMouseleave() {
  hovered = false
  clearTimeout(hoverTimer)
  if (!within(document.activeElement)) {
    dismissed = false
    scheduleClose()
  }
}

function listen(el: HTMLElement | null | undefined, add: boolean) {
  if (!el) {
    return
  }
  const method = add ? 'addEventListener' : 'removeEventListener'
  el[method]('focusin', onFocusin as EventListener)
  el[method]('focusout', onFocusout as EventListener)
  el[method]('mouseenter', onMouseenter)
  el[method]('mouseleave', onMouseleave)
}

watch(() => box, (el, old) => {
  listen(old, false)
  listen(el, true)
}, { immediate: true })

watch(hasPopover, (has) => {
  if (!has) {
    hide()
    return
  }
  if (box?.contains(document.activeElement)) {
    open.value = true
  }
})

function returnFocus() {
  const target = lastFocused && box?.contains(lastFocused) ? lastFocused : box?.querySelector<HTMLElement>('input, button, [tabindex]')
  target?.focus({ preventScroll: true })
}

function onOpenChange(next: boolean) {
  if (!next) {
    hide()
  }
}

function onEscape() {
  const focusWasInside = popoverEl()?.contains(document.activeElement) || box?.contains(document.activeElement)
  hide()
  focusWasInside && returnFocus()
}

function keepIfInside(event: Event & { detail?: { originalEvent?: Event } }) {
  const target = event.detail?.originalEvent?.target ?? event.target
  if (box?.contains(target as Node)) {
    event.preventDefault()
  }
}

function act(run?: () => unknown) {
  const focusWasInPopover = !!popoverEl()?.contains(document.activeElement)
  dismiss()
  focusWasInPopover && returnFocus()
  run?.()
}

function retry() {
  act(() => model?.retry?.())
}

function reset() {
  act(() => model?.reset?.())
}

function useTheirs() {
  act(() => model?.remoteChange.value ? model.remoteChange.value.accept() : model?.reset?.())
}

function keepMine() {
  act(() => model?.remoteChange.value ? model.remoteChange.value.keep() : model?.retry?.())
}

function runUndo() {
  act(() => undo?.run())
}

function quoted(value: unknown) {
  return shownValue(value, format)
}

onBeforeUnmount(() => {
  listen(box, false)
  clearTimeout(savedTimer)
  clearTimeout(hoverTimer)
  clearTimeout(closeTimer)
})

defineExpose({ line, open: shown })
</script>

<template>
  <span
    class="cwa:status-line"
    :data-line="line"
    data-testid="field-status-line"
    aria-hidden="true"
  />
  <span
    v-if="description"
    :id="descriptionId"
    class="cwa:sr-only"
  >{{ description }}</span>
  <PopoverRoot
    v-if="hasPopover"
    :open="shown"
    @update:open="onOpenChange"
  >
    <PopoverContent
      ref="content"
      :reference="box ?? undefined"
      side="top"
      align="start"
      :side-offset="POPOVER_GAP"
      :collision-padding="8"
      :aria-label="title"
      data-testid="field-status-popover"
      class="cwa:z-context cwa:w-max cwa:max-w-[min(20rem,calc(100vw-1rem))] cwa:bg-surface-menu cwa:p-popover cwa:text-control cwa:text-fg cwa:shadow-popover cwa:outline-none"
      @open-auto-focus.prevent
      @close-auto-focus.prevent
      @escape-key-down="onEscape"
      @pointer-down-outside="keepIfInside"
      @focus-outside.prevent
      @mouseenter="show"
      @mouseleave="scheduleClose"
    >
      <FieldStatusTitle
        :title="title"
        :glyph="line === 'undo' ? undefined : line === 'error' ? 'error' : 'conflict'"
        @close="act()"
      />
      <FieldStatusError
        v-if="line === 'error'"
        :message="state.error?.message"
        @retry="retry"
        @reset="reset"
      />
      <template v-else-if="line === 'undo'">
        <p class="cwa:m-0 cwa:trim-text">
          {{ undo?.text }}
        </p>
        <div class="cwa:mt-4 cwa:flex cwa:flex-wrap cwa:justify-end cwa:gap-actions">
          <CwaUiButton
            label="Undo"
            size="sm"
            data-testid="field-status-undo"
            @click="runUndo"
          />
        </div>
      </template>
      <template v-else>
        <p class="cwa:m-0 cwa:trim-text">
          {{ who }} changed this while you were editing.
        </p>
        <dl class="cwa:m-0 cwa:mt-2 cwa:grid cwa:gap-1 cwa:text-helper">
          <dt class="cwa:text-fg-muted">
            {{ who }}’s
          </dt>
          <dd class="cwa:m-0 cwa:bg-field cwa:px-3 cwa:py-2 cwa:break-words">
            {{ quoted(theirs) }}
          </dd>
          <dt class="cwa:text-fg-muted">
            Yours
          </dt>
          <dd class="cwa:m-0 cwa:bg-field cwa:px-3 cwa:py-2 cwa:break-words">
            {{ quoted(yours) }}
          </dd>
        </dl>
        <div class="cwa:mt-4 cwa:flex cwa:flex-wrap cwa:justify-end cwa:gap-actions">
          <CwaUiButton
            :label="`Use ${who}’s`"
            size="sm"
            data-testid="field-status-theirs"
            @click="useTheirs"
          />
          <CwaUiButton
            label="Keep mine"
            size="sm"
            data-testid="field-status-mine"
            @click="keepMine"
          />
        </div>
      </template>
      <PopoverArrow
        :width="12"
        :height="6"
        class="cwa:fill-surface-menu"
      />
    </PopoverContent>
  </PopoverRoot>
</template>
