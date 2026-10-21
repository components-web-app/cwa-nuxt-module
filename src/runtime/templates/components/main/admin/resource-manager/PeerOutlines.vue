<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useCwa } from '#cwa/composables/cwa'
import { boundsOf, instancesOf, onInstancesChange } from '#cwa/admin/manageable-instances'
import { presenceColour, usePresence } from '#cwa/admin/presence'
import type { PresencePeer } from '#cwa/admin/presence'
import { useFreshFlags } from '#cwa/admin/presence-flags'
import { useNuxtApp } from '#app/nuxt'

const $cwa = useCwa()
const teleportTarget: Element | string = useNuxtApp().vueApp._container ?? 'body'
const { onThisPage } = usePresence($cwa)
const redrawCount = ref(0)
const hovered = ref<string[]>([])

const peersByIri = computed(() => {
  const byIri: Record<string, PresencePeer[]> = {}
  for (const peer of onThisPage.value) {
    const iri = peer.component ?? peer.componentPosition
    if (!iri) {
      continue
    }
    const key = Object.keys(byIri).find(existing => $cwa.resources.findAllPublishableIris(existing).includes(iri)) ?? iri
    ;(byIri[key] ??= []).push(peer)
  }
  return byIri
})

const fresh = useFreshFlags(() => Object.fromEntries(Object.entries(peersByIri.value).map(([iri, peers]) => [
  iri,
  JSON.stringify(peers.map(peer => [peer.clientId, peer.state, peer.field, peer.component, peer.componentPosition])),
])))

function labelOf(peers: PresencePeer[]) {
  const people = new Map<string, { name: string, editing: boolean }>()
  for (const peer of peers) {
    const person = people.get(peer.user.id) ?? { name: peer.user.name || 'Someone', editing: false }
    person.editing ||= peer.state === 'editing'
    people.set(peer.user.id, person)
  }
  const list = [...people.values()]
  if (list.length === 1) {
    return list[0]!.editing ? `${list[0]!.name} is editing` : list[0]!.name
  }
  return list.map(person => person.editing ? `${person.name} (editing)` : person.name).join(', ')
}

const outlines = computed(() => {
  void redrawCount.value
  return Object.entries(peersByIri.value).flatMap(([iri, peers]) => {
    const colour = presenceColour(peers[0]!.user.id)
    const label = labelOf(peers)
    const faded = !fresh.has(iri) && !hovered.value.includes(iri)
    return instancesOf($cwa, iri)
      .map(instance => boundsOf(instance.value))
      .filter(style => !!style)
      .map(style => ({ style: { ...style, outlineColor: colour }, colour, label, faded }))
  })
})

function onMouseOver(event: MouseEvent) {
  const target = event.target as Node
  hovered.value = Object.keys(peersByIri.value).filter(iri => instancesOf($cwa, iri).some(instance => instance.value.some(element => element.contains(target))))
}

function redraw() {
  redrawCount.value++
}

let frame: number | undefined

function redrawAfterRender() {
  redraw()
  void nextTick(() => {
    frame !== undefined && cancelAnimationFrame(frame)
    frame = requestAnimationFrame(() => {
      frame = undefined
      redraw()
    })
  })
}

const stopInstances = onInstancesChange($cwa, redrawAfterRender)

watch(() => [$cwa.resources.displayPageIri.value, $cwa.resources.isLoading.value], redrawAfterRender)

onMounted(() => {
  $cwa.admin.eventBus.on('redrawFocus', redraw)
  window.addEventListener('resize', redraw)
  window.addEventListener('scroll', redraw, true)
  document.addEventListener('mouseover', onMouseOver)
})

onBeforeUnmount(() => {
  frame !== undefined && cancelAnimationFrame(frame)
  stopInstances()
  $cwa.admin.eventBus.off('redrawFocus', redraw)
  window.removeEventListener('resize', redraw)
  window.removeEventListener('scroll', redraw, true)
  document.removeEventListener('mouseover', onMouseOver)
})
</script>

<template>
  <Teleport
    v-if="outlines.length"
    :to="teleportTarget"
  >
    <div
      v-for="(outline, index) of outlines"
      :key="index"
      :style="outline.style"
      data-testid="peer-outline"
      class="cwa:absolute cwa:z-peer-outline cwa:outline-2 cwa:outline-solid cwa:outline-offset-1 cwa:pointer-events-none cwa:rounded-[1px]"
    >
      <span
        data-testid="peer-flag"
        :data-faded="outline.faded || undefined"
        :style="{ backgroundColor: outline.colour }"
        :class="outline.faded ? 'cwa:opacity-0' : 'cwa:opacity-100'"
        class="cwa:absolute cwa:bottom-full cwa:left-0 cwa:mb-px cwa:px-1.5 cwa:py-0.5 cwa:max-w-60 cwa:truncate cwa:whitespace-nowrap cwa:rounded-t-sm cwa:text-xs cwa:font-medium cwa:text-dark cwa:transition-opacity cwa:duration-300"
      >{{ outline.label }}</span>
    </div>
  </Teleport>
</template>
