<script lang="ts" setup>
import { computed, ref } from 'vue'
import { useCwaResourceManagerTab } from '#cwa/runtime/composables/cwa-resource-manager-tab'
import { DEFAULT_TAB_ORDER } from '#cwa/runtime/admin/manager-tabs-resolver'

const { exposeMeta, iri, $cwa } = useCwaResourceManagerTab({
  name: 'Info',
  order: DEFAULT_TAB_ORDER + 1
})

defineExpose(exposeMeta)

const disableButton = ref(false)

async function handleDelete () {
  if (!iri.value) {
    return
  }
  disableButton.value = true
  const result = await $cwa.resourcesManager.deleteResource({
    endpoint: iri.value,
    refreshEndpoints: $cwa.resources.getRefreshEndpointsForDelete(iri.value),
    requestCompleteFn () {
      // deselect the component and close resources manager - not sure why this was needed, on delete it would end up triggering the resource to be submitted to the API again when deleting a draft and a live is available...
      /// rm disappears as expected when these lines are removed.
      // $cwa.admin.resourceStackManager.completeStack({ clickTarget: window }, false)
      // $cwa.admin.resourceStackManager.selectStackIndex(0, false)
    }
  })
  if (result !== false) {
    $cwa.admin.toggleEdit(false)
  }
  disableButton.value = false
}

const isDeleteEnabled = computed(() => {
  if (!iri.value) {
    return false
  }
  return !$cwa.resources.isDataPage.value || $cwa.resources.isPageDataResource(iri.value).value || $cwa.admin.resourceStackManager.isEditingLayout.value
})
</script>

<template>
  <div class="cwa-flex cwa-space-x-4 cwa-items-center">
    <div class="cwa-text-sm">
      {{ iri }}
    </div>
    <div v-if="isDeleteEnabled">
      <CwaUiFormButton
        color="grey"
        button-class="cwa-min-w-[100px]"
        :disabled="disableButton"
        @click="handleDelete"
      >
        Delete
      </CwaUiFormButton>
    </div>
  </div>
</template>
