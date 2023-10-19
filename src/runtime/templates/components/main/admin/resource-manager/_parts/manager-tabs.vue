<script lang="ts" setup>
import { computed, ref, toRef, watch } from 'vue'
import ManagerTab from './manager-tab.vue'
import { CwaResourceManagerTabOptions } from '#cwa/runtime/composables/cwa-resource-manager-tab'

const props = defineProps<{
  tabs: CwaResourceManagerTabOptions[]
}>()
const reactiveTabs = toRef(props, 'tabs')
const selectedIndex = ref(0)

function getOrderValue (meta: CwaResourceManagerTabOptions) {
  return meta.order === undefined ? 0 : meta.order
}
const orderedTabs = computed(() => {
  const tabsWithOriginalSort = []
  reactiveTabs.value.forEach((tab, index) => {
    tabsWithOriginalSort.push({ ...tab, _originalIndex: index })
  })
  return tabsWithOriginalSort.sort((a, b) => (getOrderValue(a) - getOrderValue(b)))
})

function selectIndex (newIndex: number) {
  selectedIndex.value = newIndex
}

function resetTabs (newIndex: number = 0) {
  selectedIndex.value = newIndex
}

watch([selectedIndex, orderedTabs], ([newIndex]) => {
  emit('click', orderedTabs.value[newIndex]._originalIndex)
})

const emit = defineEmits<{(e: 'click', index: number): void }>()
defineExpose({ resetTabs })
</script>

<template>
  <div class="cwa-flex cwa-border-b cwa-border-stone-700 cwa-border-dashed">
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
