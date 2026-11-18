<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { PopoverArrow, PopoverContent, PopoverRoot } from 'reka-ui'
import CwaUiButton from '../../ui/Button.vue'
import XMarkIcon from '../../ui/icon/XMarkIcon.vue'
import StateGlyph from './StateGlyph.vue'
import type { ResourceModelField } from '#cwa/resources/model-editors'
import type { CwaFieldState } from '#cwa/storage/stores/resources/state'

export type LineState = 'saving' | 'saved' | 'error' | 'conflict'

const SAVED_FOR = 1180
const HOVER_DELAY = 300

const { state, name, box, model, descriptionId } = defineProps<{
  state: CwaFieldState
  name: string
  box: HTMLElement | null | undefined
  model?: ResourceModelField<any>
  descriptionId: string
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
      return (state.savedAt ?? 0) + SAVED_FOR > now.value ? 'saved' : undefined
    default:
      return undefined
  }
})

const hasPopover = computed(() => line.value === 'error' || line.value === 'conflict')

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
  return undefined
})

const title = computed(() => line.value === 'error' ? `${name}: not saved` : `${name}: changed by ${who.value}`)

const open = ref(false)
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
  if (hasPopover.value) {
    open.value = true
  }
}

function hide() {
  clearTimeout(hoverTimer)
  clearTimeout(closeTimer)
  open.value = false
}

function scheduleClose() {
  clearTimeout(closeTimer)
  closeTimer = setTimeout(() => {
    if (!within(document.activeElement) && !popoverEl()?.matches(':hover')) {
      open.value = false
    }
  }, HOVER_DELAY)
}

function onFocusin(event: FocusEvent) {
  lastFocused = event.target as HTMLElement
  show()
}

function onFocusout(event: FocusEvent) {
  if (!within(event.relatedTarget)) {
    hide()
  }
}

function onMouseenter() {
  clearTimeout(closeTimer)
  clearTimeout(hoverTimer)
  hoverTimer = setTimeout(show, HOVER_DELAY)
}

function onMouseleave() {
  clearTimeout(hoverTimer)
  if (!within(document.activeElement)) {
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
  hide()
  returnFocus()
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

function quoted(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return 'Empty'
  }
  return typeof value === 'string' ? value : JSON.stringify(value)
}

onBeforeUnmount(() => {
  listen(box, false)
  clearTimeout(savedTimer)
  clearTimeout(hoverTimer)
  clearTimeout(closeTimer)
})

defineExpose({ line, open })
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
    :open="open"
    @update:open="onOpenChange"
  >
    <PopoverContent
      ref="content"
      :reference="box ?? undefined"
      side="top"
      align="start"
      :side-offset="10"
      :collision-padding="8"
      :aria-label="title"
      data-testid="field-status-popover"
      class="cwa:z-context cwa:w-max cwa:max-w-[min(20rem,calc(100vw-1rem))] cwa:bg-surface-menu cwa:p-popover cwa:text-control cwa:text-fg cwa:shadow-popover cwa:outline-none"
      @open-auto-focus.prevent
      @close-auto-focus.prevent
      @escape-key-down="onEscape"
      @pointer-down-outside="keepIfInside"
      @focus-outside="keepIfInside"
      @mouseenter="show"
      @mouseleave="scheduleClose"
    >
      <div class="cwa:-mt-1 cwa:-mr-2 cwa:mb-1.5 cwa:flex cwa:min-h-8 cwa:items-center cwa:gap-2 cwa:font-semibold">
        <StateGlyph :kind="line === 'error' ? 'error' : 'conflict'" />
        <span class="cwa:min-w-0 cwa:flex-1">{{ title }}</span>
        <button
          type="button"
          tabindex="-1"
          aria-label="Close"
          class="cwa:grid cwa:size-8 cwa:shrink-0 cwa:cursor-pointer cwa:place-items-center cwa:text-fg-muted cwa:hover:bg-button cwa:hover:text-fg"
          @click="act()"
        >
          <XMarkIcon class="cwa:size-4" />
        </button>
      </div>
      <template v-if="line === 'error'">
        <p class="cwa:m-0">
          {{ state.error?.message || 'The server couldn’t save this.' }} Reset puts back the last saved value.
        </p>
        <div class="cwa:mt-4 cwa:flex cwa:flex-wrap cwa:justify-end cwa:gap-actions">
          <CwaUiButton
            label="Retry"
            variant="solid"
            size="sm"
            data-testid="field-status-retry"
            @click="retry"
          />
          <CwaUiButton
            label="Reset"
            size="sm"
            data-testid="field-status-reset"
            @click="reset"
          />
        </div>
      </template>
      <template v-else>
        <p class="cwa:m-0">
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
