<script lang="ts" setup>
import { computed, ref, toRef, watchEffect } from 'vue'
import ManagerTab from './ManagerTab.vue'
import type { CwaResourceManagerTabOptions } from '#cwa/runtime/composables/cwa-resource-manager-tab'

const props = defineProps<{
  tabs: CwaResourceManagerTabOptions[]
}>()
const reactiveTabs = toRef(props, 'tabs')
const selectedIndex = ref(0)

function getOrderValue (meta: CwaResourceManagerTabOptions) {
  return meta.order === undefined ? 0 : meta.order
}
const orderedTabs = computed(() => {
  const tabsWithOriginalSort: (CwaResourceManagerTabOptions & { _originalIndex: number })[] = []
  reactiveTabs.value.forEach((tab, index) => {
    tabsWithOriginalSort.push({ ...tab, _originalIndex: index })
  })
  return tabsWithOriginalSort.filter(v => !v.disabled).sort((a, b) => (getOrderValue(a) - getOrderValue(b)))
})

function selectIndex (newIndex: number) {
  selectedIndex.value = newIndex
}

function resetTabs (newIndex: number = 0) {
  selectedIndex.value = newIndex
}

const emit = defineEmits<{(e: 'click', index: number): void }>()

watchEffect(() => {
  const newIndex = orderedTabs.value[selectedIndex.value || 0]?._originalIndex || 0
  emit('click', newIndex)
})

defineExpose({ resetTabs })
</script>

<template>
  <div class="cwa-flex cwa-space-x-1 cwa-overflow-hidden cwa-items-center">
    <ManagerTab
      v-for="(tab, index) of orderedTabs"
      :key="`tab_${index}_${tab.name}`"
      :tab="tab"
      :selected="index === selectedIndex"
      class="-cwa-mb-[1px]"
      @click="selectIndex(index)"
    />
  </div>
</template>
