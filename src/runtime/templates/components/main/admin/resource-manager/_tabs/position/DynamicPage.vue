<script lang="ts" setup>
import { onMounted } from 'vue'
import { useCwaResourceManagerTab } from '#cwa/runtime/composables/cwa-resource-manager-tab'
import { DEFAULT_TAB_ORDER } from '#cwa/runtime/admin/manager-tabs-resolver'
import { useCwaResourceModel } from '#cwa/runtime/composables/cwa-resource-model'
import { useCwaSelect } from '#cwa/runtime/composables/cwa-select'
import {
  useDynamicPositionSelectOptions
} from '#cwa/runtime/templates/components/main/admin/_common/useDynamicPositionSelectOptions'

const { exposeMeta, iri, $cwa, resource } = useCwaResourceManagerTab({
  name: 'Dynamic Component',
  order: DEFAULT_TAB_ORDER
})

const { getOptions } = useDynamicPositionSelectOptions($cwa)
const { model } = useCwaResourceModel<string>(iri, 'pageDataProperty', {
  debounceTime: 0
})
const select = useCwaSelect(model)

select.options.value = [{
  label: 'Loading...',
  value: undefined
}]
async function loadOps () {
  select.options.value = await getOptions()
}

onMounted(() => {
  loadOps()
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
