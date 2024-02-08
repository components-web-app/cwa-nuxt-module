<script lang="ts" setup>
import { navigateTo } from '#app'
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

</script>

<template>
  <div>
    <div class="cwa-flex cwa-space-x-4 cwa-items-center">
      <div>
        <CwaUiFormButton :disabled="true">
          Select / Add Component
        </CwaUiFormButton>
      </div>
      <div>
        {{ resource?.data?._metadata.staticComponent ? 'Edit' : 'Add' }} fallback component?
        <a href="#" @click.prevent="goToTemplate">
          Go to page template
        </a>
      </div>
    </div>
  </div>
</template>
