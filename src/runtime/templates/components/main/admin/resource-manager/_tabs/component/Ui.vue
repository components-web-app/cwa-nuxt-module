<script lang="ts" setup>
import { computed, onMounted, ref, watchEffect } from 'vue'
import {
  useCwaResourceManagerTab,
} from '#cwa/composables/cwa-resource-manager-tab'
import { DEFAULT_TAB_ORDER } from '#cwa/admin/manager-tabs-resolver'
import type { CwaResourceMeta } from '#cwa/composables/cwa-resource'
import { useCwaResourceModel } from '#cwa/composables/cwa-resource-model'
import { useCwaSelect } from '#cwa/composables/cwa-select'
import { useDataResolver } from '#cwa/templates/components/core/useDataResolver'
import type { SelectOption } from '#cwa/composables/cwa-select-input'
import { selectStyleKeys, selectedStyleKeys } from '#cwa/composables/cwa-styles'
import type { CwaUiVariantConfig } from '#cwa/types'
import { resourcesConfig, uiConfig } from '#build/cwa-config'

const { exposeMeta, $cwa, iri } = useCwaResourceManagerTab({
  name: 'UI',
  order: DEFAULT_TAB_ORDER,
})

const savedData = computed(() => iri.value ? $cwa.resources.getResource(iri.value).value?.data : undefined)

const uiComponentModel = useCwaResourceModel<string>(iri, 'uiComponent', {
  debounceTime: 0,
})
const uiClassNamesModel = useCwaResourceModel<string[]>(iri, 'uiClassNames', {
  debounceTime: 0,
})

const uiSelect = useCwaSelect(uiComponentModel.model)

const componentMeta = ref<(CwaResourceMeta | null)[]>([])

const current = computed(() => $cwa.admin.resourceStackManager.currentStackItem.value)

const uiOptions = computed(() => {
  const options: SelectOption[] = [{
    label: 'Default',
    value: null,
  }]
  componentMeta.value.forEach((meta, index) => {
    // it seems meta can be null when re-mounting the meta resolver when changing to a draft from live (editing)
    options.push({
      label: meta?.cwaResource.name || current.value?.ui?.[index] || 'Unknown',
      value: current.value?.ui?.[index],
    })
  })
  return options
})

const styleConfig = computed<CwaUiVariantConfig | undefined>(() => {
  const uiComponent = savedData.value?.uiComponent
  if (uiComponent) {
    return uiConfig[uiComponent]
  }
  const type = savedData.value?.['@type']
  return type ? resourcesConfig[type] : undefined
})
const styles = computed(() => styleConfig.value?.styles ?? {})
const isMultipleStyles = computed(() => !!styleConfig.value?.multipleStyles)
const showStyleSelect = computed(() => Object.keys(styles.value).length > 0)

const styleNameOptions = computed<SelectOption[]>(() =>
  Object.entries(styles.value).map(([key, style]) => ({ label: style.label, value: key })),
)
const singleStyleOptions = computed<SelectOption[]>(() => [
  { label: 'Default', value: null },
  ...styleNameOptions.value,
])

const selectedStyleNames = computed<string[]>({
  get: () => selectedStyleKeys(uiClassNamesModel.model.value, styles.value),
  set: (keys) => {
    uiClassNamesModel.model.value = selectStyleKeys(uiClassNamesModel.model.value, styles.value, keys)
  },
})
const selectedStyleName = computed<string | null>({
  get: () => selectedStyleKeys(uiClassNamesModel.model.value, styles.value)[0] ?? null,
  set: (key) => {
    uiClassNamesModel.model.value = selectStyleKeys(uiClassNamesModel.model.value, styles.value, key ? [key] : [])
  },
})

const disabled = exposeMeta.disabled

watchEffect(() => {
  disabled.value = !showStyleSelect.value && !current.value?.ui?.length
})

const components = computed(() => {
  return current.value?.ui
})

const resolverProps = computed(() => {
  return {
    iri: iri.value,
  }
})

const { startDataResolver } = useDataResolver(componentMeta, {
  components,
  props: resolverProps,
  propsValidator: (props: typeof resolverProps.value) => {
    return !!props.iri
  },
})
// seem to need to start here for these to be consistent
startDataResolver()

onMounted(() => {
  watchEffect(() => {
    uiSelect.options.value = uiOptions.value
  })
})

defineExpose(exposeMeta)
</script>

<template>
  <div>
    <div class="cwa:flex cwa:gap-x-6">
      <CwaUiFormLabelWrapper
        v-if="uiSelect.options.value.length > 1"
        label="UI:"
      >
        <CwaUiSelect
          v-model="uiSelect.model.value"
          :options="uiSelect.options.value"
        />
      </CwaUiFormLabelWrapper>
      <CwaUiFormLabelWrapper
        v-if="showStyleSelect"
        label="Style:"
      >
        <CwaUiSelect
          v-if="isMultipleStyles"
          v-model="selectedStyleNames"
          :options="styleNameOptions"
          multiple
          placeholder="Default"
        />
        <CwaUiSelect
          v-else
          v-model="selectedStyleName"
          :options="singleStyleOptions"
        />
      </CwaUiFormLabelWrapper>
    </div>
  </div>
</template>
