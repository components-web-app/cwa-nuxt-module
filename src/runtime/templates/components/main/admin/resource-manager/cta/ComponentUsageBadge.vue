<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import { useCwa } from '#cwa/composables/cwa'
import { CwaResourceTypes, getResourceTypeFromIri } from '#cwa/resources/resource-utils'
import { fetchComponentUsage } from '#cwa/admin/component-usage'
import type { ComponentUsage } from '#cwa/admin/component-usage'

const $cwa = useCwa()
const currentIri = $cwa.admin.resourceStackManager.currentIri
const usage = ref<ComponentUsage>()
let request = 0

const component = computed(() => {
  const iri = currentIri.value
  if (!iri || getResourceTypeFromIri(iri) !== CwaResourceTypes.COMPONENT) {
    return
  }
  const data = $cwa.resources.getResource(iri).value?.data
  if (data?._metadata?.persisted === false) {
    return
  }
  return { iri, positions: (data?.componentPositions ?? []).join(',') }
})

watch(() => component.value && `${component.value.iri}|${component.value.positions}`, async () => {
  usage.value = undefined
  const requestId = ++request
  const iri = component.value?.iri
  if (!iri) {
    return
  }
  const fetched = await fetchComponentUsage($cwa, iri)
  if (requestId === request) {
    usage.value = fetched
  }
}, { immediate: true })
</script>

<template>
  <span
    v-if="usage && usage.total > 1"
    data-testid="component-usage-badge"
    class="cwa:whitespace-nowrap cwa:text-xs cwa:text-yellow cwa:border cwa:border-yellow/60 cwa:rounded-full cwa:py-1 cwa:px-2.5"
  >Shared · {{ usage.total }} places</span>
</template>
