<script lang="ts" setup>
import { computed, onMounted, ref, watch, watchEffect } from 'vue'
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

const current = computed(() => $cwa.admin.resourceStackManager.currentStackItem.value)

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
  const currentClasses = current.value?.styles?.value?.classes
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
disabled.value = !current.value?.styles?.value?.classes.length && !current.value?.ui?.length

onMounted(() => {
  watch(uiComponentModel.select.model, () => {
    uiClassNamesModel.model.value = null
    uiClassNamesModel.select.model.value = null
  })

  watchEffect(() => {
    uiComponentModel.select.options.value = uiOptions.value
    uiClassNamesModel.select.options.value = classOptions.value
  })
})

defineExpose(exposeMeta)
</script>

<template>
  <div>
    <div class="cwa-flex cwa-space-x-2">
      <CwaUiFormSelect v-model="uiComponentModel.select.model" :options="uiComponentModel.select.options.value" />
      <CwaUiFormSelect v-model="uiClassNamesModel.select.model" :options="uiClassNamesModel.select.options.value" />
    </div>
    <ComponentMetaResolver v-model="componentMeta" :components="current?.ui" :props="{ iri }" />
  </div>
</template>
