<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useId, useTemplateRef, watch } from 'vue'
import type { ComponentPublicInstance } from 'vue'
import type { CwaToastOptions, CwaToastTone } from '#cwa/admin/toaster'
import Button from '../../ui/Button.vue'
import Toast from './Toast.vue'

interface ToastView {
  tone: CwaToastTone
  title: string
  description?: string
  actions: { label: string, primary?: boolean }[]
}

interface ToastState {
  options: CwaToastOptions
  signature: string
  timer?: ReturnType<typeof setTimeout>
  hovered?: boolean
  focused?: boolean
  back?: HTMLElement | null
}

const MAX_VISIBLE = 3

const region = useTemplateRef<HTMLElement>('region')
const overflow = useTemplateRef<HTMLElement>('overflow')
const listId = useId()
const toasts = ref<{ id: string, view: ToastView }[]>([])
const expanded = ref(false)
const waiting = computed(() => Math.max(0, toasts.value.length - MAX_VISIBLE))
const visible = computed(() => expanded.value ? toasts.value : toasts.value.slice(0, MAX_VISIBLE))
let overflowBack: HTMLElement | null = null
const announcement = ref('')
const seeThrough = ref(false)
const states = new Map<string, ToastState>()
const elements = new Map<string, HTMLElement>()
let count = 0
let announceTimer: ReturnType<typeof setTimeout> | undefined
let recheckFrame: number | undefined

function lifetime({ tone, actions }: CwaToastOptions) {
  if (tone === 'error' || actions?.length) {
    return 0
  }
  return tone === 'warning' ? 6000 : 4000
}

function startTimer(id: string) {
  const state = states.get(id)
  if (!state) {
    return
  }
  clearTimeout(state.timer)
  const ms = lifetime(state.options)
  if (ms && !state.hovered && !state.focused) {
    state.timer = setTimeout(() => remove(id), ms)
  }
}

function hold(id: string, by: 'hovered' | 'focused', held: boolean) {
  const state = states.get(id)
  if (!state) {
    return
  }
  state[by] = held
  startTimer(id)
}

function announce({ title, description }: CwaToastOptions) {
  clearTimeout(announceTimer)
  announcement.value = ''
  announceTimer = setTimeout(() => {
    announcement.value = description ? `${title}. ${description}` : title
  }, 50)
}

function returnFocus(id: string, state: ToastState) {
  const element = elements.get(id)
  const focused = document.activeElement
  if (!element || !(focused instanceof HTMLElement) || !element.contains(focused)) {
    return
  }
  const back = state.back?.isConnected ? state.back : region.value
  back?.focus({ preventScroll: true })
}

function show(options: CwaToastOptions) {
  const id = options.id ?? `cwa-toast-${++count}`
  const view: ToastView = {
    tone: options.tone,
    title: options.title,
    description: options.description,
    actions: (options.actions ?? []).map(({ label, primary }) => ({ label, primary })),
  }
  const signature = JSON.stringify(view)
  const existing = states.get(id)
  if (existing) {
    existing.options = options
    if (existing.signature === signature) {
      return
    }
    existing.signature = signature
    const toast = toasts.value.find(toast => toast.id === id)
    if (toast) {
      toast.view = view
    }
  }
  else {
    states.set(id, { options, signature })
    toasts.value.push({ id, view })
  }
  announce(options)
  startTimer(id)
}

function remove(id: string) {
  const index = toasts.value.findIndex(toast => toast.id === id)
  const state = states.get(id)
  if (index < 0 || !state) {
    return
  }
  clearTimeout(state.timer)
  returnFocus(id, state)
  states.delete(id)
  elements.delete(id)
  toasts.value.splice(index, 1)
  state.options.onClose?.()
}

function collapse() {
  if (!expanded.value) {
    return
  }
  for (const { id } of toasts.value.slice(MAX_VISIBLE)) {
    const state = states.get(id)
    if (!state) {
      continue
    }
    returnFocus(id, state)
    if (state.hovered || state.focused) {
      state.hovered = false
      state.focused = false
      startTimer(id)
    }
  }
  expanded.value = false
}

function toggle() {
  if (expanded.value) {
    collapse()
  }
  else {
    expanded.value = true
  }
}

function dismissAll() {
  const focused = document.activeElement
  const inOverflow = focused instanceof Node && !!overflow.value?.contains(focused)
  const back = overflowBack?.isConnected ? overflowBack : region.value
  for (const { id } of [...toasts.value]) {
    remove(id)
  }
  if (inOverflow) {
    back?.focus({ preventScroll: true })
  }
}

function onOverflowFocusIn(event: FocusEvent) {
  const from = event.relatedTarget
  if (from instanceof Node && overflow.value?.contains(from)) {
    return
  }
  const other = from instanceof Node ? toastOf(from) : undefined
  overflowBack = other ? states.get(other)?.back ?? null : from instanceof HTMLElement && !region.value?.contains(from) ? from : null
}

function onEscape(event: KeyboardEvent) {
  if (event.key === 'Escape' && !event.defaultPrevented) {
    event.preventDefault()
    collapse()
  }
}

function onPointerDown(event: PointerEvent) {
  if (!(event.target instanceof Node) || !region.value?.contains(event.target)) {
    collapse()
  }
}

watch(expanded, (open) => {
  if (open) {
    document.addEventListener('keydown', onEscape)
    document.addEventListener('pointerdown', onPointerDown, true)
  }
  else {
    document.removeEventListener('keydown', onEscape)
    document.removeEventListener('pointerdown', onPointerDown, true)
  }
})

watch(waiting, (count) => {
  if (!count) {
    collapse()
  }
})

function act(id: string, index: number) {
  states.get(id)?.options.actions?.[index]?.onClick()
  remove(id)
}

function setElement(id: string, instance: Element | ComponentPublicInstance | null) {
  const element = (instance as ComponentPublicInstance | null)?.$el as HTMLElement | undefined
  if (element) {
    elements.set(id, element)
  }
  else {
    elements.delete(id)
  }
}

function toastOf(node: Node) {
  for (const [id, element] of elements) {
    if (element.contains(node)) {
      return id
    }
  }
}

function onToastFocusIn(id: string, event: FocusEvent) {
  const state = states.get(id)
  const element = elements.get(id)
  if (!state || !element) {
    return
  }
  const from = event.relatedTarget
  if (!(from instanceof Node) || !element.contains(from)) {
    const other = from instanceof Node ? toastOf(from) : undefined
    state.back = other ? states.get(other)?.back : from instanceof HTMLElement ? from : null
  }
  hold(id, 'focused', true)
}

function onToastFocusOut(id: string, event: FocusEvent) {
  const to = event.relatedTarget
  if (!(to instanceof Node) || !elements.get(id)?.contains(to)) {
    hold(id, 'focused', false)
  }
}

function hides(target: Element | null) {
  if (!target || target === document.body || region.value?.contains(target)) {
    return false
  }
  const a = target.getBoundingClientRect()
  if (!a.width || !a.height) {
    return false
  }
  return [...elements.values()].some((element) => {
    const b = element.getBoundingClientRect()
    return a.left >= b.left && a.right <= b.right && a.top >= b.top && a.bottom <= b.bottom
  })
}

function recheck() {
  seeThrough.value = hides(document.activeElement)
}

function scheduleRecheck() {
  if (recheckFrame === undefined) {
    recheckFrame = requestAnimationFrame(() => {
      recheckFrame = undefined
      recheck()
    })
  }
}

function onDocumentFocusIn(event: FocusEvent) {
  seeThrough.value = hides(event.target instanceof Element ? event.target : null)
}

const passive = { passive: true, capture: true }

watch(seeThrough, (active) => {
  if (active) {
    window.addEventListener('scroll', scheduleRecheck, passive)
    window.addEventListener('resize', scheduleRecheck, passive)
  }
  else {
    window.removeEventListener('scroll', scheduleRecheck, passive)
    window.removeEventListener('resize', scheduleRecheck, passive)
  }
})

watch(toasts, recheck, { deep: true, flush: 'post' })

onMounted(() => {
  document.addEventListener('focusin', onDocumentFocusIn)
  document.addEventListener('focusout', scheduleRecheck)
})

onBeforeUnmount(() => {
  document.removeEventListener('focusin', onDocumentFocusIn)
  document.removeEventListener('focusout', scheduleRecheck)
  window.removeEventListener('scroll', scheduleRecheck, passive)
  window.removeEventListener('resize', scheduleRecheck, passive)
  document.removeEventListener('keydown', onEscape)
  document.removeEventListener('pointerdown', onPointerDown, true)
  if (recheckFrame !== undefined) {
    cancelAnimationFrame(recheckFrame)
  }
  clearTimeout(announceTimer)
  states.forEach(state => clearTimeout(state.timer))
})

defineExpose({ show, dismiss: remove })
</script>

<template>
  <div
    ref="region"
    data-testid="toaster"
    role="region"
    aria-label="Notifications"
    tabindex="-1"
    class="cwa:fixed cwa:outline-none cwa:top-20 cwa:right-4 cwa:z-notifications cwa:flex cwa:w-[22rem] cwa:max-w-[calc(100vw-2rem)] cwa:flex-col cwa:gap-3 cwa:pointer-events-none cwa:transition-opacity cwa:duration-(--cwa-duration-fast) cwa:ease-out cwa:motion-reduce:transition-none cwa:max-sm:left-2 cwa:max-sm:right-2 cwa:max-sm:w-auto cwa:max-sm:max-w-none cwa:max-sm:in-[.cwa-fullscreen-dialog]:top-26"
    :class="{ 'cwa:opacity-15': seeThrough }"
  >
    <div
      :id="listId"
      data-testid="toaster-list"
      class="cwa:flex cwa:flex-col cwa:gap-3"
      :class="expanded ? ['cwa:-m-2 cwa:p-2 cwa:max-h-[calc(100dvh-11rem)] cwa:overflow-y-auto cwa:overscroll-contain', seeThrough ? 'cwa:pointer-events-none' : 'cwa:pointer-events-auto'] : undefined"
    >
      <TransitionGroup
        enter-active-class="cwa:transition cwa:duration-(--cwa-duration-base) cwa:ease-out cwa:motion-reduce:transition-none"
        enter-from-class="cwa:opacity-0 cwa:-translate-y-2"
        leave-active-class="cwa:transition cwa:duration-160 cwa:ease-in cwa:motion-reduce:transition-none"
        leave-to-class="cwa:opacity-0 cwa:translate-x-3"
      >
        <Toast
          v-for="toast in visible"
          :key="toast.id"
          :ref="(instance) => setElement(toast.id, instance)"
          :data-toast-id="toast.id"
          v-bind="toast.view"
          :class="seeThrough ? 'cwa:pointer-events-none' : 'cwa:pointer-events-auto'"
          @dismiss="remove(toast.id)"
          @action="(index: number) => act(toast.id, index)"
          @mouseenter="hold(toast.id, 'hovered', true)"
          @mouseleave="hold(toast.id, 'hovered', false)"
          @focusin="(event: FocusEvent) => onToastFocusIn(toast.id, event)"
          @focusout="(event: FocusEvent) => onToastFocusOut(toast.id, event)"
        />
      </TransitionGroup>
    </div>
    <div
      v-if="waiting || expanded"
      ref="overflow"
      data-testid="toaster-overflow"
      class="cwa:flex cwa:justify-end cwa:gap-2"
      :class="seeThrough ? 'cwa:pointer-events-none' : 'cwa:pointer-events-auto'"
      @focusin="onOverflowFocusIn"
    >
      <Button
        data-testid="toaster-more"
        size="sm"
        :label="expanded ? 'Show fewer' : `+${waiting} more`"
        :aria-label="expanded ? 'Show fewer notifications' : `Show ${waiting} more ${waiting === 1 ? 'notification' : 'notifications'}`"
        :aria-expanded="expanded ? 'true' : 'false'"
        :aria-controls="listId"
        @click="toggle"
      />
      <Button
        data-testid="toaster-dismiss-all"
        size="sm"
        label="Dismiss all"
        :aria-label="`Dismiss all ${toasts.length} notifications`"
        @click="dismissAll"
      />
    </div>
    <div
      data-testid="toaster-live"
      class="cwa:sr-only"
      aria-live="polite"
      aria-atomic="true"
    >
      {{ announcement }}
    </div>
  </div>
</template>
