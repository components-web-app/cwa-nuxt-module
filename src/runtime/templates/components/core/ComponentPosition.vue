<template>
  <!--CWA_MANAGER_START_POSITION-->
  <ResourceLoader v-if="componentIri" ref="resourceLoader" :iri="componentIri" :manager="manager" component-prefix="CwaComponent" />
  <ComponentPlaceholder v-else-if="$cwa.admin.isEditing" :iri="iri" />
  <!--CWA_MANAGER_END_POSITION-->
</template>

<script setup lang="ts">
import { computed, getCurrentInstance, reactive, ref, toRef } from 'vue'
import { consola } from 'consola'
import ResourceLoader from './ResourceLoader.vue'
import ComponentPlaceholder from './ComponentPlaceholder.vue'
import { useCwa, useCwaResource, useCwaResourceManageable } from '#imports'
import type { IriProp } from '#cwa/runtime/composables/cwa-resource'
import type ManageableComponent from '#cwa/runtime/admin/manageable-component'

const $cwa = useCwa()
const props = defineProps<IriProp>()
const resourceLoader = ref()
const componentManagerOps = reactive({})
const componentResourceManager = ref<undefined|{ manager: ManageableComponent }>()
const iriRef = toRef(props, 'iri')
const resource = useCwaResource(iriRef).getResource()
useCwaResourceManageable(iriRef)

const componentIri = computed(() => {
  const iri = resource.value?.data?.component
  const publishedIri = $cwa.resources.findPublishedComponentIri(iri).value
  if ($cwa.admin.isEditing) {
    const selectedEditingIri = $cwa.admin.componentManager.currentIri.value
    const draftIri = $cwa.resources.findDraftComponentIri(iri).value
    if (selectedEditingIri && [draftIri, publishedIri].includes(selectedEditingIri)) {
      return selectedEditingIri
    }
    return draftIri || iri
  }
  return publishedIri
})

const proxy = getCurrentInstance()?.proxy
if (proxy) {
  componentResourceManager.value = useCwaResourceManageable(componentIri, componentManagerOps, proxy)
} else {
  consola.error('Could not initialise the manager for a component', componentIri.value)
}
const manager = computed(() => componentResourceManager.value?.manager)
</script>
