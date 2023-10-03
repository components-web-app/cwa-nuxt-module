<script lang="ts" setup>
import { CwaResourceManagerTabOptions } from '#cwa/runtime/composables/cwa-resource-manager-tab'

defineProps<{
  tab: CwaResourceManagerTabOptions
  selected: boolean
}>()
</script>
<template>
  <button class="cwa-p-2 cwa-transition" :class="[selected ? 'cwa-bg-stone-700' : 'cwa-text-stone-300']">
    {{ tab.name }}
  </button>
</template>
