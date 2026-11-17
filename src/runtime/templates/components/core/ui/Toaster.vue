<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'
import type { ComponentPublicInstance } from 'vue'
import type { CwaToastOptions, CwaToastTone } from '#cwa/admin/toaster'
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
const toasts = ref<{ id: string, view: ToastView }[]>([])
const announcement = ref('')
const seeThrough = ref(false)
const states = new Map<string, ToastState>()
const elements = new Map<string, HTMLElement>()
let count = 0
let announceTimer: ReturnType<typeof setTimeout> | undefined

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
    toasts.value.unshift({ id, view })
    while (toasts.value.length > MAX_VISIBLE) {
      remove(toasts.value[toasts.value.length - 1]!.id)
    }
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
  states.delete(id)
  const element = elements.get(id)
  elements.delete(id)
  const focused = document.activeElement
  if (element && focused instanceof HTMLElement && element.contains(focused)) {
    if (state.back?.isConnected) {
      state.back.focus({ preventScroll: true })
    }
    else {
      focused.blur()
    }
  }
  toasts.value.splice(index, 1)
  state.options.onClose?.()
}

function act(id: string, index: number) {
  states.get(id)?.options.actions?.[index]?.onClick()
  remove(id)
}

function setElement(id: string, instance: Element | ComponentPublicInstance | null) {
  const element = (instance as ComponentPublicInstance | null)?.$el as HTMLElement | undefined
  if (element) {
    elements.set(id, element)
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
    state.back = from instanceof HTMLElement ? from : null
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
  if (!target || target === document.body) {
    return false
  }
  if (region.value?.contains(target)) {
    return seeThrough.value
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

function onDocumentFocusIn(event: FocusEvent) {
  seeThrough.value = hides(event.target instanceof Element ? event.target : null)
}

watch(toasts, () => {
  seeThrough.value = hides(document.activeElement)
}, { deep: true, flush: 'post' })

onMounted(() => document.addEventListener('focusin', onDocumentFocusIn))

onBeforeUnmount(() => {
  document.removeEventListener('focusin', onDocumentFocusIn)
  clearTimeout(announceTimer)
  states.forEach(state => clearTimeout(state.timer))
})

defineExpose({ show, dismiss: remove })
</script>

<template>
  <div
    ref="region"
    data-testid="toaster"
    class="cwa:fixed cwa:top-20 cwa:right-4 cwa:z-notifications cwa:flex cwa:w-[22rem] cwa:max-w-[calc(100vw-2rem)] cwa:flex-col cwa:gap-3 cwa:pointer-events-none cwa:transition-opacity cwa:duration-(--cwa-duration-fast) cwa:ease-out cwa:reduced-motion:transition-none cwa:max-sm:left-2 cwa:max-sm:right-2 cwa:max-sm:w-auto cwa:max-sm:max-w-none cwa:max-sm:in-[.cwa-fullscreen-dialog]:top-26"
    :class="{ 'cwa:opacity-15': seeThrough }"
  >
    <TransitionGroup
      enter-active-class="cwa:transition cwa:duration-(--cwa-duration-base) cwa:ease-out cwa:reduced-motion:transition-none"
      enter-from-class="cwa:opacity-0 cwa:-translate-y-2"
      leave-active-class="cwa:transition cwa:duration-160 cwa:ease-in cwa:reduced-motion:transition-none"
      leave-to-class="cwa:opacity-0 cwa:translate-x-3"
    >
      <Toast
        v-for="toast in toasts"
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
