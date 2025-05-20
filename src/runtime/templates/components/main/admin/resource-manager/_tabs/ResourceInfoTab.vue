<script lang="ts" setup>
import { computed, ref } from 'vue'
import { useCwaResourceManagerTab } from '#cwa/runtime/composables/cwa-resource-manager-tab'
import { DEFAULT_TAB_ORDER } from '#cwa/runtime/admin/manager-tabs-resolver'
import { NEW_RESOURCE_IRI } from '#cwa/runtime/storage/stores/resources/state'

const { exposeMeta, iri, $cwa } = useCwaResourceManagerTab({
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
  return isAddingNew.value || !$cwa.resources.isDataPage.value || $cwa.resources.isPageDataResource(iri.value).value || $cwa.admin.resourceStackManager.isEditingLayout.value
})

const isAddingNew = computed(() => {
  return iri.value === NEW_RESOURCE_IRI
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
        {{ isAddingNew ? 'Discard' : 'Delete' }}
      </CwaUiFormButton>
    </div>
  </div>
</template>
