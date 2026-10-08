<script lang="ts" setup>
import { CwaResourceTypes, getPublishedResourceState, getResourceTypeFromIri } from '#cwa/resources/resource-utils'
import { computed, ref } from 'vue'
import { useCwaResourceManagerTab } from '#cwa/composables/cwa-resource-manager-tab'
import { DEFAULT_TAB_ORDER } from '#cwa/admin/manager-tabs-resolver'
import { NEW_RESOURCE_IRI } from '#cwa/storage/stores/resources/state'

const { exposeMeta, iri, $cwa, resource } = useCwaResourceManagerTab({
  name: 'Info',
  order: DEFAULT_TAB_ORDER + 1,
})

defineExpose(exposeMeta)

const disableButton = ref(false)

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
  const result = await $cwa.resourcesManager.deleteResource({
    endpoint: iri.value,
    refreshEndpoints: $cwa.resources.getRefreshEndpointsForDelete(iri.value),
  })
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
