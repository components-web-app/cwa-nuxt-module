<template>
  <ListFilter />
  <ListContainer class="cwa-py-4">
    <div class="cwa-relative">
      <Spinner class="cwa-absolute" :show="loading" />
      <template v-if="!loading">
        <div v-if="!items.length" class="cwa-flex cwa-justify-center">
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
          <li v-for="(item, index) in items" :key="`list-item-${index}`">
            <slot name="item" v-bind="item">
              <div class="cwa-dark-blur cwa-p-2 cwa-border cwa-border-light/20">
                <span class="cwa-font-bold">No list item template UI provided</span>
                <pre class="cwa-text-xs cwa-p-2 cwa-max-h-40 cwa-overflow-auto">{{ item }}</pre>
              </div>
            </slot>
          </li>
        </ul>
      </template>
    </div>
  </ListContainer>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import ListContainer from '#cwa/runtime/templates/components/core/admin/ListContainer.vue'
import Spinner from '#cwa/runtime/templates/components/utils/Spinner.vue'
import ListFilter from '#cwa/runtime/templates/components/core/admin/ListFilter.vue'
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

watch(() => route.query, () => {
  reloadItems()
})

onMounted(() => {
  reloadItems()
})
</script>
