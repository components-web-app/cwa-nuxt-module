<template>
  <ListContainer class="cwa-py-4">
    <div class="cwa-relative">
      <Transition
        appear
        mode="out-in"
        enter-from-class="cwa-transform cwa-opacity-0"
        enter-active-class="cwa-duration-200 cwa-ease-out"
        enter-to-class="cwa-opacity-100"
        leave-from-class="cwa-opacity-100"
        leave-active-class="cwa-duration-200 cwa-ease-in"
        leave-to-class="cwa-transform cwa-opacity-0"
      >
        <Spinner v-if="loading" class="cwa-absolute" :show="true" />
        <div v-else-if="!items.length" class="cwa-flex cwa-justify-center">
          <div class="cwa-w-full cwa-max-w-xl cwa-text-center cwa-flex cwa-flex-col cwa-space-y-2 cwa-text-stone-400">
            <div class="cwa-flex cwa-justify-center">
              <CwaUiIconWarningIcon class="cwa-w-20" />
            </div>
            <h2 class="cwa-font-bold">
              Sorry, no items found
            </h2>
          </div>
        </div>
        <ul v-else class="cwa-flex cwa-flex-col cwa-space-y-4">
          <li v-for="(item, index) in itemsFromStore" :key="`list-item-${index}`">
            <slot name="item" v-bind="item">
              <div class="cwa-dark-blur cwa-p-2 cwa-border cwa-border-light/20">
                <span class="cwa-font-bold">No list item template UI provided</span>
                <pre class="cwa-text-xs cwa-p-2 cwa-max-h-40 cwa-overflow-auto">{{ item }}</pre>
              </div>
            </slot>
          </li>
        </ul>
      </Transition>
    </div>
  </ListContainer>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import ListContainer from '#cwa/runtime/templates/components/core/admin/ListContainer.vue'
import Spinner from '#cwa/runtime/templates/components/utils/Spinner.vue'
import { useCwa } from '#imports'

const $cwa = useCwa()
const route = useRoute()

const props = defineProps<{
  fetchUrl: string
}>()

const loading = ref(true)
const items = ref<any[]>([])
const currentRequestId = ref<number>(0)

async function reloadItems () {
  const thisRequestId = currentRequestId.value + 1
  currentRequestId.value = thisRequestId
  loading.value = true
  const { response } = $cwa.fetch({ path: props.fetchUrl })
  const { _data: data } = await response
  if (thisRequestId === currentRequestId.value) {
    data && (items.value = data['hydra:member'])
    loading.value = false
  }
}

const itemsFromStore = computed(() => {
  const mergedItems = []
  for (const item of items.value) {
    const storeItemData = $cwa.resources.getResource(item['@id']).value?.data
    mergedItems.push(storeItemData || item)
  }
  return mergedItems
})

watch(() => route.query, (oldQuery, newQuery) => {
  if (JSON.stringify(oldQuery) === JSON.stringify(newQuery)) {
    return
  }
  reloadItems()
})

onMounted(() => {
  reloadItems()
})

defineExpose({
  reloadItems
})
</script>
