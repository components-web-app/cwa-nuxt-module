<script lang="ts" setup>
import { useCwaResourceManagerTab } from '#cwa/runtime/composables/cwa-resource-manager-tab'
import { DEFAULT_TAB_ORDER } from '#cwa/runtime/admin/manager-tabs-resolver'
import { useCwa } from '#imports'

const $cwa = useCwa()

const { exposeMeta, iri } = useCwaResourceManagerTab({
  name: 'Group',
  order: DEFAULT_TAB_ORDER,
})

defineExpose(exposeMeta)

function addComponent(addAfter: boolean) {
  if (!iri.value) {
    return
  }
  $cwa.resourcesManager.initAddResource(iri.value, addAfter, $cwa.admin.resourceStackManager.resourceStack.value)
}
function addStart() {
  addComponent(false)
}
function addEnd() {
  addComponent(true)
}
</script>

<template>
  <div class="cwa:flex cwa:gap-x-4">
    <CwaUiFormButton @click="addStart">
      Add to start
    </CwaUiFormButton>
    <CwaUiFormButton @click="addEnd">
      Add to end
    </CwaUiFormButton>
  </div>
</template>
