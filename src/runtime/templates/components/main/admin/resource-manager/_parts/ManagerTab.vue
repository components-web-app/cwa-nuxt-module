<script lang="ts" setup>
import type { CwaResourceManagerTabOptions } from '#cwa/runtime/composables/cwa-resource-manager-tab'

defineProps<{
  tab: CwaResourceManagerTabOptions
  selected: boolean
}>()
</script>

<template>
  <button
    class="cwa:py-1.5 cwa:px-3 cwa:transition cwa:rounded cwa:cursor-pointer"
    :class="[selected ? 'cwa:text-stone-100 cwa:bg-stone-700/80' : 'cwa:text-stone-400 cwa:hover:text-stone-300']"
  >
    {{ tab.name }}
  </button>
</template>
