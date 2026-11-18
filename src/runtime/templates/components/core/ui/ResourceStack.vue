<script setup lang="ts">
import { computed, getCurrentInstance, h, nextTick, onBeforeUnmount, onMounted, ref, useId, useTemplateRef, watch } from 'vue'
import type { VNode } from 'vue'
import { createReusableTemplate } from '@vueuse/core'
import { DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle, PopoverAnchor, PopoverContent, PopoverPortal, PopoverRoot } from 'reka-ui'
import { placeResourceStack } from './resource-stack'
import type { ResourceStackLevel, StackPoint } from './resource-stack'
import { useAnnounce } from './field-context'

const { levels, selected, at, label = 'Select a resource', limit = 5, select, minWidth, avoid, returnTo, keyboard = false } = defineProps<{
  levels: ResourceStackLevel[]
  at: HTMLElement | StackPoint
  select: (key: string) => unknown
  selected?: string
  label?: string
  limit?: number
  minWidth?: number
  avoid?: HTMLElement | null
  returnTo?: HTMLElement | null
  keyboard?: boolean
}>()

const emit = defineEmits<{ close: [] }>()

const announce = useAnnounce()
const [DefineBody, ReuseBody] = createReusableTemplate()
const sheet = typeof window !== 'undefined' && !!window.matchMedia?.('(max-width: 639.98px)').matches
const app = getCurrentInstance()?.appContext.app as { _container?: unknown } | undefined
let behind: HTMLElement | undefined

const id = useId()
const open = ref(true)
const showAll = ref(false)
const busy = ref(false)
const announcement = ref('')
const selectedIndex = computed(() => levels.findIndex(level => level.key === selected))
const highlight = ref(Math.max(0, selectedIndex.value))
const highlightBy = ref<'pointer' | 'keyboard' | undefined>(keyboard ? 'keyboard' : undefined)
const position = ref<{ left: number, top: number }>()
const content = useTemplateRef<{ $el: HTMLElement } | null>('content')
const tree = useTemplateRef<HTMLElement | null>('tree')
const moreButton = useTemplateRef<HTMLElement | null>('moreButton')
const opener = typeof document === 'undefined' ? null : document.activeElement as HTMLElement | null
const maxWidth = typeof document === 'undefined' ? undefined : document.documentElement.clientWidth - 16
let growing: Animation | undefined

const shown = computed(() => showAll.value ? levels.length : Math.min(limit, levels.length))
const hiddenCount = computed(() => levels.length - shown.value)
const parentsWord = (count: number) => count === 1 ? 'parent' : 'parents'

function anchorPoint() {
  if (at instanceof HTMLElement) {
    const { left, top } = at.getBoundingClientRect()
    return { x: left, y: top }
  }
  return at
}

const reference = computed(() => {
  const { x, y } = position.value ? { x: position.value.left, y: position.value.top } : anchorPoint()
  return {
    getBoundingClientRect: () => ({ x, y, left: x, top: y, right: x, bottom: y, width: 0, height: 0 }),
  }
})

function levelId(index: number) {
  return `${id}-level-${index}`
}

function place() {
  const panel = content.value?.$el as HTMLElement | undefined
  const inner = panel?.querySelector?.<HTMLElement>('[data-stack-innermost]')
  if (!panel || !inner) {
    const { x, y } = anchorPoint()
    position.value = { left: x, top: y }
    return
  }
  const panelRect = panel.getBoundingClientRect()
  const innerRect = inner.getBoundingClientRect()
  const anchorRect = at instanceof HTMLElement ? at.getBoundingClientRect() : at
  position.value = placeResourceStack(
    anchorRect,
    {
      panel: { width: panel.offsetWidth, height: panel.offsetHeight },
      inner: { left: innerRect.left - panelRect.left, top: innerRect.top - panelRect.top, width: innerRect.width, height: innerRect.height },
    },
    { width: document.documentElement.clientWidth, height: window.innerHeight },
    avoid?.getBoundingClientRect(),
  )
  return { panel, inner: { x: innerRect.left - panelRect.left + innerRect.width / 2, y: innerRect.top - panelRect.top + innerRect.height / 2 } }
}

function reducedMotion(panel: HTMLElement) {
  return typeof panel.animate !== 'function' || !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

function slideUp(panel: HTMLElement) {
  if (reducedMotion(panel)) {
    return
  }
  panel.animate([{ transform: 'translateY(1.5rem)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 200, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' })
  document.querySelector<HTMLElement>('[data-testid="resource-stack-scrim"]')?.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: 200 })
}

function grow(panel: HTMLElement, origin: { x: number, y: number }) {
  if (reducedMotion(panel)) {
    return
  }
  panel.style.transformOrigin = `${origin.x}px ${origin.y}px`
  growing = panel.animate([{ transform: 'scale(0.9)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 150, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' })
}

const stopPlacing = watch(tree, async (element) => {
  if (!element) {
    return
  }
  stopPlacing()
  await nextTick()
  if (sheet) {
    const container = app?._container
    if (open.value && container instanceof HTMLElement && !container.hasAttribute('inert')) {
      behind = container
      container.setAttribute('inert', '')
    }
    position.value = { left: 0, top: 0 }
    element.focus({ preventScroll: true })
    const panel = content.value?.$el as HTMLElement | undefined
    panel && slideUp(panel)
    return
  }
  const placed = place()
  await nextTick()
  element.focus({ preventScroll: true })
  if (focusVisible(element)) {
    highlightBy.value = 'keyboard'
  }
  placed && grow(placed.panel, placed.inner)
}, { flush: 'post' })

function focusVisible(element: HTMLElement) {
  try {
    return element.matches(':focus-visible')
  }
  catch {
    return false
  }
}

function close(refocus: boolean) {
  if (!open.value) {
    return
  }
  open.value = false
  behind?.removeAttribute('inert')
  emit('close')
  const target = returnTo ?? opener
  const refocusTarget = () => refocus && target?.isConnected && target.focus({ preventScroll: true })
  sheet ? nextTick(refocusTarget) : refocusTarget()
}

async function choose(index: number) {
  const level = levels[index]
  if (busy.value || !level) {
    return
  }
  busy.value = true
  let result: unknown
  try {
    result = await select(level.key)
  }
  finally {
    busy.value = false
  }
  close(true)
  result !== false && announce(`${level.label} selected`)
}

function move(index: number) {
  highlightBy.value = 'keyboard'
  highlight.value = Math.min(shown.value - 1, Math.max(0, index))
  document.getElementById(levelId(highlight.value))?.scrollIntoView?.({ block: 'nearest' })
}

async function showMore() {
  const count = hiddenCount.value
  showAll.value = true
  await nextTick()
  growing?.finish()
  place()
  tree.value?.focus({ preventScroll: true })
  announcement.value = `${count} more ${parentsWord(count)} shown`
}

function onTreeKeydown(event: KeyboardEvent) {
  if (event.altKey || event.metaKey) {
    return
  }
  if (busy.value) {
    event.preventDefault()
    return
  }
  const { key } = event
  if (key === 'ArrowUp' || key === 'ArrowRight') {
    move(highlight.value - 1)
  }
  else if (key === 'ArrowDown' || key === 'ArrowLeft') {
    if (key === 'ArrowDown' && highlight.value === shown.value - 1 && hiddenCount.value) {
      moreButton.value?.focus({ preventScroll: true })
    }
    else {
      move(highlight.value + 1)
    }
  }
  else if (key === 'Home' || key === 'End') {
    move(key === 'Home' ? 0 : shown.value - 1)
  }
  else if (key === 'Enter' || key === ' ') {
    choose(highlight.value)
  }
  else if (key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
    const letter = key.toLowerCase()
    const count = shown.value
    for (let step = 1; step <= count; step++) {
      const index = (highlight.value + step) % count
      if (levels[index]!.label.toLowerCase().startsWith(letter)) {
        move(index)
        break
      }
    }
    return
  }
  else {
    return
  }
  event.preventDefault()
}

function onMoreKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowUp') {
    event.preventDefault()
    tree.value?.focus({ preventScroll: true })
  }
}

function onPanelKeydown(event: KeyboardEvent) {
  if (event.key === 'Tab') {
    event.preventDefault()
    !busy.value && close(true)
  }
}

function nameRowIndex(event: Event) {
  const row = (event.target as HTMLElement | null)?.closest?.('[data-stack-name]')
  return row ? Number(row.getAttribute('data-stack-name')) : undefined
}

function onPointerMove(event: PointerEvent) {
  const index = nameRowIndex(event)
  if (index === undefined) {
    if (highlightBy.value === 'pointer') {
      highlightBy.value = undefined
    }
    return
  }
  highlight.value = index
  highlightBy.value = 'pointer'
}

function onPointerLeave() {
  if (highlightBy.value === 'pointer') {
    highlightBy.value = undefined
  }
}

function onTreeClick(event: MouseEvent) {
  const index = nameRowIndex(event)
  index !== undefined && choose(index)
}

function onPointerDownOutside(event: CustomEvent<{ originalEvent: PointerEvent }>) {
  const { originalEvent } = event.detail
  if (busy.value || originalEvent.button === 2 || (at instanceof HTMLElement && originalEvent.target instanceof Node && at.contains(originalEvent.target))) {
    event.preventDefault()
  }
}

function onEscape(event: KeyboardEvent) {
  if (busy.value) {
    return
  }
  event.preventDefault()
  close(true)
}

function onOpenChange(value: boolean) {
  !value && !busy.value && close(sheet)
}

function onResize() {
  !sheet && close(false)
}

const pageScroll = { x: 0, y: 0 }

function onScroll(event: Event) {
  const panel = content.value?.$el
  const isPage = event.target === document || event.target === window
  if (sheet || busy.value || (panel && event.target instanceof Node && panel.contains(event.target)) || (isPage && window.scrollX === pageScroll.x && window.scrollY === pageScroll.y)) {
    return
  }
  close(false)
}

onMounted(() => {
  pageScroll.x = window.scrollX
  pageScroll.y = window.scrollY
  window.addEventListener('scroll', onScroll, true)
  window.addEventListener('resize', onResize)
})
onBeforeUnmount(() => {
  behind?.removeAttribute('inert')
  window.removeEventListener('scroll', onScroll, true)
  window.removeEventListener('resize', onResize)
})

function box(index: number): VNode {
  const level = levels[index]!
  const isSelected = index === selectedIndex.value
  const isHighlighted = index === highlight.value
  const isHovered = isHighlighted && highlightBy.value === 'pointer'
  const child = index > 0
    ? [h('div', { role: 'group', class: 'cwa:flex cwa:min-w-0 cwa:flex-col' }, [box(index - 1)])]
    : []
  return h('div', {
    'id': levelId(index),
    'role': 'treeitem',
    'aria-level': levels.length - index,
    'aria-label': level.label,
    'aria-selected': isSelected ? 'true' : 'false',
    'aria-expanded': index > 0 ? 'true' : undefined,
    'data-stack-innermost': index === 0 ? '' : undefined,
    'data-testid': 'resource-stack-level',
    'class': [
      'cwa:flex cwa:min-w-0 cwa:flex-col cwa:gap-1.5 cwa:border cwa:p-1.5',
      isHovered ? 'cwa:border-solid cwa:border-fg cwa:bg-field-hover' : 'cwa:border-dashed cwa:border-line-dash cwa:bg-surface-menu',
      isHighlighted && highlightBy.value === 'keyboard' ? 'cwa:outline-2 cwa:outline-accent-fg' : '',
      isHighlighted && !highlightBy.value ? 'cwa:in-focus-visible:outline-2 cwa:in-focus-visible:outline-accent-fg' : '',
      isHighlighted ? (index === shown.value - 1 ? 'cwa:-outline-offset-2' : 'cwa:outline-offset-1') : '',
    ],
    'style': index === 0 && minWidth ? { minWidth: `${minWidth}px` } : undefined,
  }, [
    ...child,
    h('div', {
      'data-stack-name': index,
      'class': [
        'cwa:flex cwa:min-h-7 cwa:cursor-pointer cwa:items-center cwa:gap-2 cwa:pr-1 cwa:pl-2 cwa:text-label cwa:text-fg',
        isSelected ? 'cwa:font-semibold cwa:shadow-[inset_3px_0_0_var(--cwa-color-accent-fg)]' : '',
      ],
    }, [
      h('span', { class: 'cwa:min-w-0 cwa:flex-1 cwa:truncate' }, level.label),
    ]),
  ])
}

const StackTree = () => shown.value ? box(shown.value - 1) : null

function dialogId() {
  const panel = content.value?.$el as HTMLElement | undefined
  return panel?.matches?.('[role="dialog"]') ? panel.id : panel?.querySelector?.('[role="dialog"]')?.id
}

defineExpose({ close, contentId: computed(() => position.value && dialogId()) })
</script>

<template>
  <DefineBody>
    <div
      :id="id"
      ref="tree"
      role="tree"
      tabindex="-1"
      :aria-label="label"
      :aria-activedescendant="levelId(highlight)"
      :aria-busy="busy || undefined"
      class="cwa:flex cwa:max-w-full cwa:min-w-0 cwa:flex-col cwa:outline-1 cwa:outline-transparent"
      :class="sheet ? 'cwa:w-full' : 'cwa:w-max'"
      @keydown="onTreeKeydown"
      @mousedown.prevent
      @pointermove="onPointerMove"
      @pointerleave="onPointerLeave"
      @click="onTreeClick"
    >
      <StackTree />
    </div>
    <div
      v-if="hiddenCount"
      class="cwa:px-2 cwa:py-1"
    >
      <button
        ref="moreButton"
        type="button"
        :tabindex="sheet ? 0 : -1"
        data-testid="resource-stack-more"
        class="cwa:min-h-6 cwa:cursor-pointer cwa:text-helper cwa:text-accent-fg cwa:underline cwa:underline-offset-2 cwa:outline-1 cwa:outline-transparent cwa:focus-visible:outline-2 cwa:focus-visible:outline-offset-2 cwa:focus-visible:outline-accent-fg"
        @keydown="onMoreKeydown"
        @click="showMore"
      >
        Show {{ hiddenCount }} more {{ parentsWord(hiddenCount) }}
      </button>
    </div>
    <span
      role="status"
      aria-live="polite"
      class="cwa:sr-only"
    >{{ announcement }}</span>
  </DefineBody>
  <DialogRoot
    v-if="sheet"
    :open="open"
    @update:open="onOpenChange"
  >
    <DialogPortal>
      <DialogOverlay
        data-testid="resource-stack-scrim"
        class="cwa:fixed cwa:inset-0 cwa:z-context cwa:bg-black/40"
      />
      <DialogContent
        ref="content"
        aria-modal="true"
        :aria-describedby="undefined"
        data-testid="resource-stack"
        class="cwa:fixed cwa:inset-x-0 cwa:bottom-0 cwa:z-context cwa:flex cwa:max-h-[70vh] cwa:flex-col cwa:bg-surface-menu cwa:pb-[env(safe-area-inset-bottom)] cwa:text-fg cwa:shadow-popover cwa:outline-1 cwa:outline-transparent"
        @open-auto-focus.prevent
        @close-auto-focus.prevent
        @pointer-down-outside="onPointerDownOutside"
        @escape-key-down="onEscape"
      >
        <div class="cwa:flex cwa:min-h-11 cwa:shrink-0 cwa:items-center cwa:justify-between cwa:gap-2 cwa:pl-4 cwa:shadow-[inset_0_-1px_0_var(--cwa-color-line)]">
          <DialogTitle class="cwa:text-label cwa:font-semibold cwa:text-fg">
            {{ label }}
          </DialogTitle>
          <button
            type="button"
            data-testid="resource-stack-close"
            class="cwa:min-h-11 cwa:cursor-pointer cwa:px-4 cwa:text-label cwa:text-fg cwa:outline-1 cwa:outline-transparent cwa:hover:bg-field-hover cwa:focus-visible:outline-2 cwa:focus-visible:-outline-offset-2 cwa:focus-visible:outline-accent-fg"
            @click="close(true)"
          >
            Close
          </button>
        </div>
        <div class="cwa:min-h-0 cwa:overflow-y-auto cwa:p-2">
          <ReuseBody />
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
  <PopoverRoot
    v-else
    :open="open"
    @update:open="onOpenChange"
  >
    <PopoverAnchor :reference="reference" />
    <PopoverPortal>
      <PopoverContent
        ref="content"
        side="bottom"
        align="start"
        :side-offset="0"
        :avoid-collisions="false"
        :aria-label="label"
        data-testid="resource-stack"
        class="cwa:z-context cwa:flex cwa:max-h-[calc(100dvh-1rem)] cwa:flex-col cwa:overflow-y-auto cwa:bg-surface-menu cwa:text-fg cwa:shadow-popover cwa:outline-1 cwa:outline-transparent"
        :style="{ visibility: position ? undefined : 'hidden', maxWidth: maxWidth === undefined ? undefined : `${maxWidth}px` }"
        @open-auto-focus.prevent
        @close-auto-focus.prevent
        @focus-outside.prevent
        @pointer-down-outside="onPointerDownOutside"
        @escape-key-down="onEscape"
        @keydown="onPanelKeydown"
      >
        <ReuseBody />
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
