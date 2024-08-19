<template>
  <div class="cwa-flex cwa-border-b cwa-border-b-stone-700 cwa-py-6 cwa-space-x-4 cwa-items-center">
    <div class="cwa-grow cwa-flex cwa-flex-col cwa-space-y-1 cwa-min-w-0">
      <pre>{{ data.associatedResource }}</pre>
      <pre>{{ dataTypes }}</pre>
      <span class="cwa-text-xl cwa-truncate">{{ data.path }}</span>
      <span v-if="relatedResource" class="cwa-text-stone-400">
        <span class="cwa-inline-flex cwa-max-w-full cwa-bg-dark cwa-p-2 cwa-font-bold cwa-space-x-2 cwa-items-center">
          <IconRoutes v-if="resourceType === 'Route'" class="cwa-h-5" />
          <IconData v-else-if="resourceType === 'PageData'" class="cwa-h-5" />
          <IconPages v-else-if="resourceType === 'Page'" class="cwa-h-5" />
          <span class="cwa-truncate">{{ relatedResource || 'Unknown' }}</span>
        </span>
      </span>
      <span v-else>
        <span class="cwa-inline-flex cwa-truncate cwa-bg-magenta/60 cwa-text-white cwa-font-bold cwa-py-1 cwa-px-3 cwa-border cwa-border-magenta cwa-rounded">
          This route has no association and should be deleted
        </span>
      </span>
    </div>
    <div>
      <CwaUiFormButton v-if="relatedResource" :to="linkFn(getAssociatedIri(data), '_cwa-pages', '#routes')">
        <IconPages v-if="data.page" class="cwa-h-6" />
        <IconData v-else class="cwa-h-6" />
        <span class="cwa-sr-only">View</span>
      </CwaUiFormButton>
      <CwaUiFormButton v-else-if="!data.redirect" color="error" @click="$emit('delete', data['@id'])">
        <CwaUiIconBinIcon class="cwa-w-4 cwa-m-1" />
        <span class="cwa-sr-only">Delete</span>
      </CwaUiFormButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'
import { computed } from 'vue'
import IconPages from '#cwa/runtime/templates/components/core/assets/IconPages.vue'
import IconRoutes from '#cwa/runtime/templates/components/core/assets/IconRoutes.vue'
import type { CwaResource } from '#cwa/runtime/resources/resource-utils'
import IconData from '#cwa/runtime/templates/components/core/assets/IconData.vue'
import { useDataList } from '#cwa/layer/pages/_cwa/composables/useDataList'
const { dataTypes } = useDataList()

const props = defineProps<{
  data: CwaResource
  linkFn:(iri: string, routeName?: string, hash?: string) => RouteLocationRaw
}>()

defineEmits<{
  delete: [string]
}>()

const resourceType = computed<undefined|'Route'|'Page'|'PageData'>(() => {
  const assocResource = props.data.associatedResource
  if (!assocResource) {
    return
  }
  if (props.data.redirect) {
    return 'Route'
  }
  if (assocResource['@type'] === 'Page') {
    return 'Page'
  }
  return 'PageData'
})

const relatedResource = computed(() => {
  if (resourceType.value === 'Page') {
    return props.data.associatedResource.reference
  }
  if (resourceType.value === 'PageData') {
    return props.data.associatedResource.title
  }
  if (resourceType.value === 'Route') {
    return props.data.associatedResource.path
  }
  return undefined
})

function getAssociatedIri (data: any) {
  return data.page || data.pageData
}
</script>
