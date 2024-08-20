<template>
  <div class="cwa-flex cwa-flex-col cwa-h-full">
    <div v-if="tabs.length > 1" class="cwa-mb-4">
      <div class="cwa-flex cwa-space-x-1 cwa-overflow-hidden cwa-items-center cwa-text-lg">
        <button
          v-for="(tab, index) of tabs"
          :id="tab.id"
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
      <slot v-if="tabs[selectedTabIndex]?.id" :name="tabs[selectedTabIndex]?.id">
        No tab content provided for tab index `{{ selectedTabIndex }}`- ID: `{{ tabs[selectedTabIndex].id }}`
      </slot>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
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
  // todo: attempt to fix TypeError: Cannot redefine property: __navigationId
  // replicated by opening data in admin on details tab, clicking to view the data page, opening data modal, clicking to the routes tab
  // does not resolve, but it does stop the error from preventing the routes to load
  setTimeout(() => {
    router.replace({ ...route, hash: `#${selectedTabId.value}` })
  }, 100)
}

function getIndexFromHash () {
  const currentHash = route.hash?.substring(1, route.hash.length)
  if (!currentHash) {
    return 0
  }
  const initialHashValue = route.hash.substring(1, route.hash.length)
  return getIndexFromId(initialHashValue)
}

function getIndexFromId (checkId: string) {
  const index = props.tabs.findIndex(({ id }) => id === checkId)
  return index !== -1 ? index : 0
}

const selectedTabIndex = ref(getIndexFromHash())
const selectedTabId = computed(() => {
  return props.tabs[selectedTabIndex.value]?.id
})

const indexAndId = computed(() => {
  return {
    index: selectedTabIndex.value,
    id: selectedTabId.value
  }
})

// if the tabs change due to resource changing (like changing to static/dynamic) then we want to ideally satay on the same tab if it exists or return to 0
watch(indexAndId, (newValues, oldValues) => {
  if (oldValues.id === undefined) {
    return
  }
  const indexIsSame = oldValues.index === newValues.index
  const idHasChanged = oldValues.id !== newValues.id
  if (indexIsSame && idHasChanged) {
    selectedTabIndex.value = getIndexFromId(oldValues.id)
  }
})
</script>
