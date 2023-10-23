<script lang="ts" setup>
import type { CwaResourceManagerTabOptions } from '#cwa/runtime/composables/cwa-resource-manager-tab'

defineProps<{
  tab: CwaResourceManagerTabOptions
  selected: boolean
}>()
</script>
<template>
  <button class="cwa-p-2 cwa-transition" :class="[selected ? 'cwa-bg-dark' : 'cwa-text-stone-300']">
    {{ tab.name }}
  </button>
</template>
