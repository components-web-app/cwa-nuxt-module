<script lang="ts" setup>
import { onMounted } from 'vue'
import { useCwaResourceManagerTab } from '#cwa/runtime/composables/cwa-resource-manager-tab'
import { DEFAULT_TAB_ORDER } from '#cwa/runtime/admin/manager-tabs-resolver'
import { useCwaResourceModel } from '#cwa/runtime/composables/cwa-resource-model'
import type { SelectOption } from '#cwa/runtime/templates/components/ui/form/Select.vue'
import { useCwaSelect } from '#cwa/runtime/composables/cwa-select'

const { exposeMeta, iri, $cwa, resource } = useCwaResourceManagerTab({
  name: 'Dynamic Component',
  order: DEFAULT_TAB_ORDER
})

const { model } = useCwaResourceModel<string>(iri, 'pageDataProperty', {
  debounceTime: 0
})
const select = useCwaSelect(model)

select.options.value = [{
  label: 'Loading...',
  value: undefined
}]

async function loadOps () {
  const newOptions: SelectOption[] = [{
    label: 'None',
    value: null
  }]
  const docs = await $cwa.getApiDocumentation()
  const pageDataMeta = docs?.pageDataMetadata?.['hydra:member']
  if (pageDataMeta) {
    for (const { properties } of pageDataMeta) {
      newOptions.push(...properties.map(({ property }) => ({ label: property, value: property })))
    }
  }
  select.options.value = newOptions
}

onMounted(async () => {
  await loadOps()
})

defineExpose(exposeMeta)
</script>

<template>
  <div>
    <div class="cwa-flex cwa-space-x-4 cwa-items-center">
      <CwaUiFormSelect v-model="select.model.value" :options="select.options.value" />
      <div v-if="!resource?.data?.component">
        <CwaUiFormButton :disabled="true">
          Add Fallback Component (to do)
        </CwaUiFormButton>
      </div>
    </div>
  </div>
</template>
