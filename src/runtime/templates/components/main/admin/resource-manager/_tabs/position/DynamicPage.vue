<script lang="ts" setup>
import { onMounted } from 'vue'
import { useCwaResourceManagerTab } from '#cwa/runtime/composables/cwa-resource-manager-tab'
import { DEFAULT_TAB_ORDER } from '#cwa/runtime/admin/manager-tabs-resolver'
import { useCwaResourceModel } from '#cwa/runtime/composables/cwa-resource-model'

const { exposeMeta, iri, $cwa, resource } = useCwaResourceManagerTab({
  name: 'Dynamic Component',
  order: DEFAULT_TAB_ORDER
})

const { select } = useCwaResourceModel<string>(iri, 'pageDataProperty', {
  debounceTime: 0
})

const defaultOp = {
  label: 'None',
  value: null
}

async function loadOps () {
  select.options.value = [defaultOp]
  const docs = await $cwa.getApiDocumentation()
  const pageDataMeta = docs?.pageDataMetadata?.['hydra:member']
  if (pageDataMeta) {
    for (const { properties } of pageDataMeta) {
      select.options.value.push(...properties.map(({ property }) => ({ label: property, value: property })))
    }
  }
}

onMounted(async () => {
  await loadOps()
})

defineExpose(exposeMeta)
</script>

<template>
  <div>
    <div class="cwa-flex cwa-space-x-4 cwa-items-center">
      <CwaUiFormSelect v-model="select.model" :options="select.options.value" />
      <div v-if="!resource?.data?.component">
        <CwaUiFormButton :disabled="true">
          Add Fallback Component (to do)
        </CwaUiFormButton>
      </div>
    </div>
  </div>
</template>
