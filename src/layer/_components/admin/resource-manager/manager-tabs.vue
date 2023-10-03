<script lang="ts" setup>
import ManagerTab from './manager-tab.vue'
import { CwaResourceManagerTabOptions } from '#cwa/runtime/composables/cwa-resource-manager-tab'

defineProps<{
  tabs: CwaResourceManagerTabOptions[]
  selectedIndex: number
}>()

defineEmits<{(e: 'click', index: number): void }>()
</script>
<template>
  <div class="cwa-flex cwa-border-b cwa-border-stone-700 cwa-border-dashed">
    <ManagerTab
      v-for="(tab, index) of tabs"
      :key="`tab_${index}_${tab.name}`"
      :tab="tab"
      :selected="index === selectedIndex"
      class="-cwa-mb-[1px]"
      @click="$emit('click', index)"
    />
  </div>
</template>
