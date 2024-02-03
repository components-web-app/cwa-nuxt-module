<script lang="ts" setup>
import { ref } from 'vue'
import { useCwaResourceManagerTab } from '#cwa/runtime/composables/cwa-resource-manager-tab'
import { DEFAULT_TAB_ORDER } from '#cwa/runtime/admin/manager-tabs-resolver'

const { exposeMeta, iri, $cwa, resource } = useCwaResourceManagerTab({
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
  const componentPositions = resource.value?.data?.componentPositions
  let componentGroups: string[]|undefined
  if (componentPositions) {
    componentGroups = []
    for (const posIri of componentPositions) {
      const positionResource = $cwa.resources.getResource(posIri).value
      if (positionResource?.data) {
        componentGroups.push(positionResource.data.componentGroup)
      }
    }
  }
  await $cwa.resourcesManager.deleteResource({
    endpoint: iri.value,
    refreshEndpoints: componentGroups,
    requestCompleteFn () {
      $cwa.admin.resourceStackManager.addToStack({ clickTarget: window }, false)
      $cwa.admin.resourceStackManager.selectStackIndex(0)
    }
  })
  $cwa.admin.toggleEdit(false)
  disableButton.value = false
}
</script>

<template>
  <div class="cwa-flex cwa-space-x-4 cwa-items-center">
    <div class="cwa-text-sm">
      {{ iri }}
    </div>
    <div>
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
