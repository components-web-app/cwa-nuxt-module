<script lang="ts" setup>
import { onMounted, ref, watch } from 'vue'
import { isEqual } from 'lodash-es'
import { useCwaResourceManagerTab } from '#cwa/runtime/composables/cwa-resource-manager-tab'
import { DEFAULT_TAB_ORDER } from '#cwa/runtime/admin/manager-tabs-resolver'
import { useCwaResourceModel } from '#cwa/runtime/composables/cwa-resource-model'
import type { SelectOption } from '#cwa/runtime/templates/components/ui/form/Select.vue'

const { exposeMeta, iri, $cwa, resource } = useCwaResourceManagerTab({
  name: 'Dynamic Component',
  order: DEFAULT_TAB_ORDER
})

const pageDataProperty = useCwaResourceModel<string>(iri, 'pageDataProperty', {
  debounceTime: 0
})
const pdSelectOption = ref()

const defaultOp = {
  label: 'None',
  value: null
}
const pdPropOps = ref<SelectOption[]>([defaultOp])

async function loadOps () {
  pdPropOps.value = [defaultOp]
  const docs = await $cwa.getApiDocumentation()
  const pageDataMeta = docs?.pageDataMetadata?.['hydra:member']
  if (pageDataMeta) {
    for (const { properties } of pageDataMeta) {
      pdPropOps.value.push(...properties.map(({ property }) => ({ label: property, value: property })))
    }
  }
}

onMounted(async () => {
  await loadOps()
  pdSelectOption.value = pdPropOps.value.find(op => isEqual(op.value, pageDataProperty.model.value))
  watch(pdSelectOption, (newOp) => {
    pageDataProperty.model.value = newOp?.value
  })
})

defineExpose(exposeMeta)
</script>

<template>
  <div>
    <div class="cwa-flex cwa-space-x-4 cwa-items-center">
      <CwaUiFormSelect v-model="pdSelectOption" :options="pdPropOps" />
      <div v-if="!resource?.data?.component">
        <CwaUiFormButton :disabled="true">
          Add Fallback Component (to do)
        </CwaUiFormButton>
      </div>
    </div>
  </div>
</template>
