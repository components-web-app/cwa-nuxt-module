<script lang="ts" setup>
import { computed, nextTick, ref, toRef, watchEffect } from 'vue'
import ManagerTab from './ManagerTab.vue'
import type { CwaResourceManagerTabOptions } from '#cwa/composables/cwa-resource-manager-tab'
import { badgeFor } from '#cwa/admin/field-badge'
import type { CwaFieldState } from '#cwa/storage/stores/resources/state'

const props = defineProps<{
  tabs: (CwaResourceManagerTabOptions & { fields?: string[] })[]
  fieldStates?: Record<string, CwaFieldState>
  idPrefix: string
  label: string
}>()
const reactiveTabs = toRef(props, 'tabs')
const selectedIndex = ref(0)

function getOrderValue(meta: CwaResourceManagerTabOptions) {
  return meta.order === undefined ? 0 : meta.order
}
const orderedTabs = computed(() => {
  const tabsWithOriginalSort: (CwaResourceManagerTabOptions & { fields?: string[], _originalIndex: number })[] = []
  reactiveTabs.value.forEach((tab, index) => {
    tabsWithOriginalSort.push({ ...tab, _originalIndex: index })
  })
  return tabsWithOriginalSort.filter(v => !v.disabled).sort((a, b) => (getOrderValue(a) - getOrderValue(b)))
})

const badges = computed(() => orderedTabs.value.map(tab => badgeFor((tab.fields ?? []).map(field => props.fieldStates?.[field]))))

function selectIndex(newIndex: number) {
  selectedIndex.value = newIndex
}

function tabId(originalIndex: number) {
  return `${props.idPrefix}-tab-${originalIndex}`
}

function onKeydown(event: KeyboardEvent, index: number) {
  const count = orderedTabs.value.length
  const moves: Record<string, number> = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: count - 1 }
  if (!(event.key in moves) || event.altKey || event.metaKey || event.ctrlKey || !count) {
    return
  }
  event.preventDefault()
  const next = (moves[event.key]! + count) % count
  selectIndex(next)
  const originalIndex = orderedTabs.value[next]!._originalIndex
  nextTick(() => document.getElementById(tabId(originalIndex))?.focus())
}

function resetTabs(newIndex: number = 0) {
  selectedIndex.value = newIndex
}

function selectOriginal(originalIndex: number) {
  const index = orderedTabs.value.findIndex(tab => tab._originalIndex === originalIndex)
  index > -1 && selectIndex(index)
}

const emit = defineEmits<{ (e: 'click', index: number): void }>()

watchEffect(() => {
  const newIndex = orderedTabs.value[selectedIndex.value || 0]?._originalIndex || 0
  emit('click', newIndex)
})

defineExpose({ resetTabs, selectOriginal })
</script>

<template>
  <div
    role="tablist"
    :aria-label="label"
    class="cwa:flex cwa:h-full cwa:items-stretch cwa:overflow-x-auto cwa:[scrollbar-width:none] cwa:[&::-webkit-scrollbar]:hidden"
  >
    <ManagerTab
      v-for="(tab, index) of orderedTabs"
      :id="tabId(tab._originalIndex)"
      :key="`tab_${index}_${tab.name}`"
      :tab="tab"
      :selected="index === selectedIndex"
      :badge="badges[index]"
      :controls="`${idPrefix}-panel`"
      @click="selectIndex(index)"
      @keydown="onKeydown($event, index)"
    />
  </div>
</template>
