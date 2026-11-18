<script setup lang="ts">
import { computed } from 'vue'
import CwaUiBadge from '#cwa/templates/components/ui/Badge.vue'
import ClockGlyph from '#cwa/templates/components/core/ui/ClockGlyph.vue'
import { getRouteLiveState, isRouteGatedByAncestor, routeLiveStateLabel, routeReachableAt } from '#cwa/resources/route-publication'
import type { CwaRouteLiveAt } from '#cwa/resources/route-publication'
import { formatDateTime } from '#cwa/resources/date-time-input'

const { publication, now } = defineProps<{
  publication: CwaRouteLiveAt
  now?: Date
}>()

const status = computed(() => {
  const at = now ?? new Date()
  if (isRouteGatedByAncestor(publication, at)) {
    return { tone: 'warning' as const, text: 'Held back by parent' }
  }
  const state = getRouteLiveState(publication, at)
  const label = routeLiveStateLabel(publication, at)
  if (state === 'scheduled') {
    return { tone: 'accent' as const, text: `${label} · ${formatDateTime(routeReachableAt(publication))}`, clock: true }
  }
  return { tone: state === 'live' ? 'success' as const : 'neutral' as const, text: label }
})
</script>

<template>
  <CwaUiBadge
    :tone="status.tone"
    :icon="status.clock ? ClockGlyph : undefined"
    :dot="!status.clock"
    data-route-publication
  >
    {{ status.text }}
  </CwaUiBadge>
</template>
