<script lang="ts" setup>
import type { CwaResourceManagerTabOptions } from '#cwa/runtime/composables/cwa-resource-manager-tab'

defineProps<{
  tab: CwaResourceManagerTabOptions
  selected: boolean
}>()
</script>
<template>
  <button class="cwa-py-2 cwa-px-3 cwa-transition" :class="[selected ? 'cwa-text-stone-100 cwa-bg-stone-700/80' : 'cwa-text-stone-400 hover:cwa-text-stone-300']">
    {{ tab.name }}
  </button>
</template>
