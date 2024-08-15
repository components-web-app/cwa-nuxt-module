<template>
  <div class="cwa-flex cwa-flex-col cwa-h-full">
    <div v-if="tabs.length > 1" class="cwa-mb-4">
      <div class="cwa-flex cwa-space-x-1 cwa-overflow-hidden cwa-items-center cwa-text-lg">
        <button
          v-for="(tab, index) of tabs"
          :key="`tab-button-${tab.id}`"
          class="cwa-py-1.5 cwa-px-5 cwa-transition cwa-rounded"
          :class="[index === selectedTabIndex ? 'cwa-text-stone-100 cwa-bg-stone-700/80' : 'cwa-text-stone-400 hover:cwa-text-stone-300']"
          @click="selectTab(index)"
        >
          {{ tab.label }}
        </button>
      </div>
    </div>
    <div class="cwa-grow cwa-min-h-0 cwa-overflow-auto">
      <slot :name="tabs[selectedTabIndex].id">
        No tab content provided for tab index `{{ selectedTabIndex }}`- ID: `{{ tabs[selectedTabIndex].id }}`
      </slot>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import { useRoute, useRouter } from '#imports'

export type ResourceModalTab = {
  id: string
  label: string
}

const router = useRouter()
const route = useRoute()

const props = defineProps<{
  tabs: ResourceModalTab[]
}>()

function selectTab (index: number) {
  selectedTabIndex.value = index
  router.push({ ...route, hash: `#${props.tabs[selectedTabIndex.value].id}` })
}

function getIndexFromHash () {
  const currentHash = route.hash?.substring(1, route.hash.length)
  if (!currentHash) {
    return 0
  }
  const initialHashValue = route.hash.substring(1, route.hash.length)
  return props.tabs.findIndex(({ id }) => id === initialHashValue) || 0
}

const selectedTabIndex = ref(getIndexFromHash())
</script>
