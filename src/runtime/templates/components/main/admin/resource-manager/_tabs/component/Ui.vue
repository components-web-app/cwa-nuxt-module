<script lang="ts" setup>
import { computed, onMounted, ref, watch, watchEffect } from 'vue'
import { watchOnce } from '@vueuse/core'
import {
  useCwaResourceManagerTab,
} from '#cwa/composables/cwa-resource-manager-tab'
import { DEFAULT_TAB_ORDER } from '#cwa/admin/manager-tabs-resolver'
import type { CwaResourceMeta } from '#cwa/composables/cwa-resource'
import { useCwaResourceModel } from '#cwa/composables/cwa-resource-model'
import { useCwaSelect } from '#cwa/composables/cwa-select'
import { useDataResolver } from '#cwa/templates/components/core/useDataResolver'
import type { SelectOption } from '#cwa/composables/cwa-select-input'
import { deriveSelectedStyles, mergeSelectedStyles } from '#cwa/composables/cwa-styles'

const { exposeMeta, $cwa, iri } = useCwaResourceManagerTab({
  name: 'UI',
  order: DEFAULT_TAB_ORDER,
})

const savedUiComponent = computed(() => iri.value ? $cwa.resources.getResource(iri.value).value?.data?.uiComponent : undefined)

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

// Styles map to the resource's flat `uiClassNames: string[]` as one entry per selected style (its
// class string — see cwa-styles), for BOTH single and multiple select. The select operates on style
// NAMES; single mode picks at most one (with a "Default"/none option), multiple picks several.
const styleClasses = computed<Record<string, string | string[]>>(() => current.value?.styles?.value?.classes || {})
const isMultipleStyles = computed(() => !!current.value?.styles?.value?.multiple)
const showStyleSelect = computed(() => Object.keys(styleClasses.value).length > 0)

const styleNameOptions = computed<SelectOption[]>(() =>
  Object.keys(styleClasses.value).map(name => ({ label: name, value: name })),
)
const singleStyleOptions = computed<SelectOption[]>(() => [
  { label: 'Default', value: null },
  ...styleNameOptions.value,
])

// multiple: array of selected names <-> one uiClassNames entry per style
const selectedStyleNames = computed<string[]>({
  get: () => deriveSelectedStyles(uiClassNamesModel.model.value, styleClasses.value),
  set: (names) => {
    const merged = mergeSelectedStyles(names, styleClasses.value)
    uiClassNamesModel.model.value = merged.length ? merged : null
  },
})
// single: at most one selected name <-> a one-element (or null) uiClassNames
const selectedStyleName = computed<string | null>({
  get: () => deriveSelectedStyles(uiClassNamesModel.model.value, styleClasses.value)[0] ?? null,
  set: (name) => {
    uiClassNamesModel.model.value = name ? mergeSelectedStyles([name], styleClasses.value) : null
  },
})

const disabled = exposeMeta.disabled

watchEffect(() => {
  const classesObj = current.value?.styles?.value?.classes
  disabled.value = (!classesObj || !Object.keys(classesObj).length) && !current.value?.ui?.length
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
  // trying to update ui class names too early, as the result may be a different IRI and sending in another
  // request before database is updated can result in sql error
  // when watching uiSelect.model
  watch(uiSelect.model, () => {
    watchOnce(savedUiComponent, () => {
      uiClassNamesModel.model.value = null
    })
  })

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
