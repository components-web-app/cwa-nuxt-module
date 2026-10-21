<script setup lang="ts">
import { computed } from 'vue'
import type { FocusedPeer } from '#cwa/admin/presence'
import { useFreshFlags } from '#cwa/admin/presence-flags'

const props = defineProps<{
  peers: FocusedPeer[]
}>()

const fresh = useFreshFlags(() => ({ field: JSON.stringify(props.peers.map(peer => peer.user.id)) }))
const colour = computed(() => props.peers[0]?.colour)
const label = computed(() => props.peers.map(peer => peer.user.name || 'Someone').join(', '))
const faded = computed(() => !fresh.has('field'))
</script>

<template>
  <div
    data-testid="field-presence"
    :style="{ outlineColor: colour }"
    class="cwa:absolute cwa:inset-0 cwa:outline-1 cwa:outline-solid cwa:outline-offset-2 cwa:pointer-events-none cwa:rounded-[1px]"
  >
    <span
      data-testid="field-presence-flag"
      :data-faded="faded || undefined"
      :style="{ backgroundColor: colour }"
      :class="faded ? 'cwa:opacity-0 cwa:group-hover/field:opacity-100' : 'cwa:opacity-100'"
      class="cwa:absolute cwa:bottom-full cwa:left-0 cwa:mb-0.5 cwa:px-1.5 cwa:py-0.5 cwa:max-w-60 cwa:truncate cwa:whitespace-nowrap cwa:rounded-t-sm cwa:text-xs cwa:font-medium cwa:text-dark cwa:transition-opacity cwa:duration-300"
    >{{ label }}</span>
  </div>
</template>
