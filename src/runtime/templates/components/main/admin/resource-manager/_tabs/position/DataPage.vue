<script lang="ts" setup>
import { navigateTo } from '#app'
import { computed } from 'vue'
import { useCwaResourceManagerTab } from '#cwa/runtime/composables/cwa-resource-manager-tab'
import { DEFAULT_TAB_ORDER } from '#cwa/runtime/admin/manager-tabs-resolver'

const { exposeMeta, resource, $cwa } = useCwaResourceManagerTab({
  name: 'Data Placeholder',
  order: DEFAULT_TAB_ORDER
})

defineExpose(exposeMeta)

async function goToTemplate () {
  if (!$cwa.resources.pageIri.value) {
    return
  }
  await navigateTo(`${$cwa.resources.pageIri.value}?cwa_force=true`)
  $cwa.admin.toggleEdit(false)
}

const hasDynamicComponent = computed(() => {
  if (!resource.value?.data?.component) {
    return false
  }
  if (!resource.value?.data?._metadata.staticComponent) {
    return true
  }
  return resource.value?.data?.component !== resource.value?.data?._metadata.staticComponent
})

function selectComponent () {
  const componentIri = resource.value?.data?.component
  if (!componentIri) {
    return
  }
  $cwa.admin.eventBus.emit('selectResource', componentIri)
}
</script>

<template>
  <div>
    <div class="cwa-flex cwa-space-x-4 cwa-items-center">
      <div v-if="!!resource?.data?._metadata.isDynamicPosition">
        <CwaUiFormButton
          v-if="hasDynamicComponent"
          @click="selectComponent"
        >
          Select Component
        </CwaUiFormButton>
        <CwaUiFormButton
          v-else
          :disabled="true"
        >
          Add Component ( Todo )
        </CwaUiFormButton>
      </div>
      <div>
        {{ resource?.data?._metadata.staticComponent ? 'Edit' : 'Add' }} fallback component?
        <a href="#" @click.prevent="goToTemplate">
          Go to page dynamic page
        </a>
      </div>
    </div>
  </div>
</template>
