<script lang="ts" setup>
import { CwaResourceManagerTabOptions } from '#cwa/runtime/composables/cwa-resource-manager-tab'

defineProps<{
  tab: CwaResourceManagerTabOptions
  selected: boolean
}>()
</script>
<template>
  <button class="cwa-p-2" :class="{ 'cwa-bg-stone-700': selected }">
    {{ tab.name }}
  </button>
</template>
