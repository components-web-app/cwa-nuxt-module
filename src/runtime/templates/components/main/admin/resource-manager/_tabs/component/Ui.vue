<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import {
  useCwaResourceManagerTab
} from '#cwa/runtime/composables/cwa-resource-manager-tab'
import { DEFAULT_TAB_ORDER } from '#cwa/runtime/admin/manager-tabs-resolver'
import type { CwaResourceMeta } from '#cwa/runtime/composables/cwa-resource'
import ComponentMetaResolver from '#cwa/runtime/templates/components/core/ComponentMetaResolver.vue'
import { useCwaResourceModel } from '#cwa/runtime/composables/cwa-resource-model'
import type { SelectOption } from '#cwa/runtime/templates/components/ui/form/Select.vue'

const { exposeMeta, $cwa, iri } = useCwaResourceManagerTab({
  name: 'UI',
  order: DEFAULT_TAB_ORDER
})

const uiComponentModel = useCwaResourceModel<string>(iri, 'uiComponent', {
  debounceTime: 0
})
const uiClassNamesModel = useCwaResourceModel<string[]>(iri, 'uiClassNames', {
  debounceTime: 0
})

const componentMeta = ref<CwaResourceMeta[]>([])

const current = computed(() => $cwa.admin.componentManager.currentStackItem.value)

const uiOptions = computed(() => {
  const options: SelectOption[] = [{
    label: 'Default',
    value: null
  }]
  componentMeta.value.forEach((meta, index) => {
    options.push({
      label: meta.cwaResource.name || current.value?.ui?.[index] || 'Unknown',
      value: current.value?.ui?.[index]
    })
  })
  return options
})
const classOptions = computed(() => {
  const options: SelectOption[] = [{
    label: 'Default',
    value: null
  }]
  const currentClasses = current.value?.styles?.classes
  if (currentClasses) {
    for (const [styleName, styles] of Object.entries(currentClasses)) {
      options.push({
        label: styleName,
        value: styles
      })
    }
  }
  return options
})

const disabled = exposeMeta.disabled
disabled.value = !current.value?.styles?.classes.length && !current.value?.ui?.length

const uiOption = ref(classOptions.value.find(op => op.value === uiComponentModel.model.value))
watch(uiOption, (newOp) => {
  uiComponentModel.model.value = newOp?.value
})

const classOption = ref(classOptions.value.find(op => op.value === uiClassNamesModel.model.value))
watch(classOption, (newOp) => {
  uiClassNamesModel.model.value = newOp?.value
})

// reset the class names if we are changing the UI
watch(uiComponentModel.model, () => {
  uiClassNamesModel.model.value = null
})

defineExpose(exposeMeta)
</script>

<template>
  <div>
    <div class="cwa-flex cwa-space-x-4">
      <CwaUiFormSelect v-model="uiOption" :options="uiOptions" />
      <CwaUiFormSelect v-model="classOption" :options="classOptions" />
    </div>
    <ComponentMetaResolver v-model="componentMeta" :components="current?.ui" :props="{ iri }" />
  </div>
</template>
