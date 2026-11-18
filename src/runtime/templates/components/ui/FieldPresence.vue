<script setup lang="ts">
import { computed, inject, onBeforeUnmount, ref, useAttrs, useTemplateRef, watch } from 'vue'
import type { FocusedPeer } from '#cwa/admin/presence'
import { useFreshFlags } from '#cwa/admin/presence-flags'
import type { ResourceModelField } from '#cwa/resources/model-editors'
import { presenceLayerKey } from '../core/ui/field-keys'

const FLAG_RISE_PX = 9
const FLAG_CLASSES = 'cwa:max-w-60 cwa:px-1 cwa:truncate cwa:whitespace-nowrap cwa:text-[0.6875rem] cwa:leading-[0.875rem] cwa:font-medium cwa:text-dark cwa:pointer-events-none cwa:transition-opacity cwa:duration-300'

const { model } = defineProps<{
  model?: ResourceModelField<any>
}>()

const attrs = useAttrs()
const layer = inject(presenceLayerKey, undefined)
const root = useTemplateRef<HTMLElement>('root')
const peers = computed<FocusedPeer[]>(() => model?.focusedBy?.value ?? [])
const fresh = useFreshFlags(() => ({ field: JSON.stringify(peers.value.map(peer => peer.user.id)) }))
const colour = computed(() => peers.value[0]?.colour)
const names = computed(() => peers.value.map(peer => peer.name).join(', '))
const focusedHere = ref(false)
const hovered = ref(false)
const label = computed(() => {
  if (!focusedHere.value) {
    return names.value
  }
  const plural = peers.value.length > 1 || peers.value[0]?.isSelf
  return `${names.value} ${plural ? 'are' : 'is'} editing this too`
})
const faded = computed(() => !fresh.has('field') && !focusedHere.value)
const layerEl = computed(() => peers.value.length ? layer?.el.value ?? undefined : undefined)
const placed = ref<Record<string, string>>({})

function onFocusin() {
  focusedHere.value = !!attrs.onFocusin
}

function onFocusout(event: FocusEvent) {
  focusedHere.value = !!root.value?.contains(event.relatedTarget as Node | null)
}

function place() {
  const field = root.value
  const target = layerEl.value
  if (!field || !target || !layer) {
    return
  }
  const box = field.getBoundingClientRect()
  const within = target.getBoundingClientRect()
  const top = `${box.top - within.top - FLAG_RISE_PX}px`
  placed.value = layer.align === 'end'
    ? { top, right: `${within.right - box.right}px` }
    : { top, left: `${box.left - within.left}px` }
}

let frame = 0
function redraw() {
  cancelAnimationFrame(frame)
  frame = requestAnimationFrame(place)
}

let resizes: ResizeObserver | undefined
function stopFollowing() {
  cancelAnimationFrame(frame)
  resizes?.disconnect()
  resizes = undefined
  window.removeEventListener('scroll', redraw, true)
  window.removeEventListener('resize', redraw)
}

watch([layerEl, root], ([target, field]) => {
  stopFollowing()
  if (!target || !field) {
    return
  }
  place()
  window.addEventListener('scroll', redraw, true)
  window.addEventListener('resize', redraw)
  if (typeof ResizeObserver !== 'undefined') {
    resizes = new ResizeObserver(redraw)
    resizes.observe(field)
    resizes.observe(target)
  }
}, { flush: 'post' })

onBeforeUnmount(stopFollowing)
</script>

<template>
  <div
    ref="root"
    class="cwa:relative cwa:isolate cwa:group/field"
    @focusin="onFocusin"
    @focusout="onFocusout"
    @pointerenter="hovered = true"
    @pointerleave="hovered = false"
  >
    <slot />
    <div
      v-if="peers.length"
      data-testid="field-presence"
      :data-focused="focusedHere || undefined"
      :style="focusedHere ? undefined : { boxShadow: `inset 0 0 0 2px ${colour}` }"
      class="cwa:absolute cwa:inset-0 cwa:z-[1] cwa:pointer-events-none"
    >
      <span
        v-if="!layerEl"
        data-testid="field-presence-flag"
        :data-faded="faded || undefined"
        :style="{ backgroundColor: colour }"
        :class="[FLAG_CLASSES, faded && !hovered ? 'cwa:opacity-0' : 'cwa:opacity-100']"
        class="cwa:absolute cwa:bottom-full cwa:left-0"
      >{{ label }}</span>
    </div>
    <Teleport
      v-if="layerEl"
      :to="layerEl"
    >
      <span
        data-testid="field-presence-flag"
        :data-faded="faded || undefined"
        :style="{ backgroundColor: colour, ...placed }"
        :class="[FLAG_CLASSES, faded && !hovered ? 'cwa:opacity-0' : 'cwa:opacity-100']"
        class="cwa:absolute"
      >{{ label }}</span>
    </Teleport>
  </div>
</template>
