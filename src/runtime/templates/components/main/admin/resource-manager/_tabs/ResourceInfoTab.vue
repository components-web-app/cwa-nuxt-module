<script lang="ts" setup>
import { CwaResourceTypes, getPublishedResourceState, getResourceTypeFromIri } from '#cwa/resources/resource-utils'
import { computed, ref, watch } from 'vue'
import { useNuxtApp } from '#app/nuxt'
import { useCwaResourceManagerTab } from '#cwa/composables/cwa-resource-manager-tab'
import { DEFAULT_TAB_ORDER } from '#cwa/admin/manager-tabs-resolver'
import { NEW_RESOURCE_IRI } from '#cwa/storage/stores/resources/state'
import { fetchComponentUsage } from '#cwa/admin/component-usage'
import type { ComponentUsage } from '#cwa/admin/component-usage'

const { exposeMeta, iri, $cwa, resource } = useCwaResourceManagerTab({
  name: 'Info',
  order: DEFAULT_TAB_ORDER + 1,
})

defineExpose(exposeMeta)

const { vueApp } = useNuxtApp()
const disableButton = ref(false)
const usage = ref<ComponentUsage>()

const isPersistedComponent = computed(() => !!iri.value
  && getResourceTypeFromIri(iri.value) === CwaResourceTypes.COMPONENT
  && resource.value?.data?._metadata?.persisted !== false)

watch([iri, isPersistedComponent], async ([currentIri, persisted]) => {
  usage.value = undefined
  if (!currentIri || !persisted) {
    return
  }
  const fetched = await fetchComponentUsage($cwa, currentIri)
  if (iri.value === currentIri) {
    usage.value = fetched
  }
}, { immediate: true })

async function chooseLocations(total: number) {
  const { default: DeleteLocationsDialog } = await import('#cwa/templates/components/core/admin/DeleteLocationsDialog.vue')
  const { createConfirmDialog } = await import('#cwa/admin/confirm-dialog')
  const dialog = await createConfirmDialog(vueApp, DeleteLocationsDialog)
  const { isCanceled, data } = await dialog.reveal({ total })
  return isCanceled ? undefined : data as 'all' | 'here'
}

function removeFromLocation(positionIri: string, groupIri?: string) {
  const property: string | undefined = $cwa.resources.getResource(positionIri).value?.data?.pageDataProperty
  const pageDataIri = property ? $cwa.resources.pageDataIriOf(positionIri).value : undefined
  if (property && pageDataIri) {
    return $cwa.resourcesManager.updateResource({
      endpoint: pageDataIri,
      data: { [property]: null },
      refreshEndpoints: [positionIri],
    })
  }
  return $cwa.resourcesManager.deleteResource({
    endpoint: positionIri,
    refreshEndpoints: groupIri ? [groupIri] : [],
  }, true)
}

async function deleteSelected(componentIri: string) {
  const positionIri = $cwa.admin.resourceStackManager.getClosestStackItemByType(CwaResourceTypes.COMPONENT_POSITION)
  const total = isPersistedComponent.value ? (await fetchComponentUsage($cwa, componentIri))?.total ?? 0 : 0
  const deleteEvent = {
    endpoint: componentIri,
    refreshEndpoints: $cwa.resources.getRefreshEndpointsForDelete(componentIri),
  }
  if (!positionIri || total <= 1) {
    return $cwa.resourcesManager.deleteResource(deleteEvent)
  }
  const choice = await chooseLocations(total)
  if (choice === 'all') {
    return $cwa.resourcesManager.deleteResource(deleteEvent, true)
  }
  if (choice === 'here') {
    return removeFromLocation(positionIri, $cwa.admin.resourceStackManager.getClosestStackItemByType(CwaResourceTypes.COMPONENT_GROUP))
  }
  return false
}

async function handleDelete() {
  if (!iri.value) {
    return
  }
  if (isAddingNew.value) {
    if (await $cwa.resourcesManager.confirmDiscardAddingResource()) {
      $cwa.admin.emptyStack()
    }
    return
  }

  disableButton.value = true
  const result = await deleteSelected(iri.value)
  if (result !== false) {
    $cwa.admin.emptyStack()
  }
  disableButton.value = false
}

const isDeleteEnabled = computed(() => {
  if (!iri.value) {
    return false
  }
  if (getResourceTypeFromIri(iri.value) === CwaResourceTypes.COMPONENT_GROUP) {
    return !$cwa.admin.resourceStackManager.isComponentGroupDisabled(iri.value, resource.value?.data?.location)
  }
  if (
    isAddingNew.value
    || $cwa.admin.resourceStackManager.isEditingLayout.value
    || !$cwa.resources.isDataPage.value
  ) {
    return true
  }
  const groupIri = $cwa.admin.resourceStackManager.getClosestStackItemByType(CwaResourceTypes.COMPONENT_GROUP)
  // on a data page, not editing layout and not adding new.
  return $cwa.resources.isPageDataResource(iri.value).value || !!groupIri
})

const isAddingNew = computed(() => {
  return iri.value === NEW_RESOURCE_IRI
})

const deleteLabel = computed(() => {
  if (isAddingNew.value) {
    return 'Discard'
  }
  const publishableState = resource.value ? getPublishedResourceState(resource.value) : undefined
  if (publishableState === true) {
    return 'Delete Live'
  }
  if (publishableState === false) {
    return 'Delete Draft'
  }
  return 'Delete'
})
</script>

<template>
  <div class="cwa:flex cwa:gap-x-4 cwa:items-center">
    <div class="cwa:text-sm">
      {{ isAddingNew ? '[New Resource]' : iri }}
    </div>
    <div
      v-if="usage && usage.total > 1"
      class="cwa:text-sm cwa:text-stone-400 cwa:whitespace-nowrap"
    >
      Used in {{ usage.total }} locations
    </div>
    <div v-if="isDeleteEnabled">
      <CwaUiFormButton
        color="grey"
        button-class="cwa:min-w-[100px]"
        :disabled="disableButton"
        @click="handleDelete"
      >
        {{ deleteLabel }}
      </CwaUiFormButton>
    </div>
  </div>
</template>
