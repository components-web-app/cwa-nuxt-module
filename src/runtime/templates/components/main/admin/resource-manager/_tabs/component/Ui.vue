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
const classNamesSelect = useCwaSelect(uiClassNamesModel.model)

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

const classOptions = computed(() => {
  const options: SelectOption[] = [{
    label: 'Default',
    value: null,
  }]
  const currentClasses = current.value?.styles?.value?.classes
  if (currentClasses) {
    for (const [styleName, styles] of Object.entries(currentClasses)) {
      options.push({
        label: styleName,
        value: styles,
      })
    }
  }
  return options
})

// Multiple-style mode: the select operates on style NAMES, and the resource stores one merged
// `uiClassNames` entry per selected style (see cwa-styles). Single mode is unchanged — it uses
// `classOptions` / `classNamesSelect`, whose option values are the raw class arrays.
const styleClasses = computed<Record<string, string[]>>(() => current.value?.styles?.value?.classes || {})
const isMultipleStyles = computed(() => !!current.value?.styles?.value?.multiple)
const multipleStyleOptions = computed<SelectOption[]>(() =>
  Object.keys(styleClasses.value).map(name => ({ label: name, value: name })),
)
const selectedStyleNames = computed<string[]>({
  get: () => deriveSelectedStyles(uiClassNamesModel.model.value, styleClasses.value),
  set: (names) => {
    const merged = mergeSelectedStyles(names, styleClasses.value)
    uiClassNamesModel.model.value = merged.length ? merged : null
  },
})
const showStyleSelect = computed(() =>
  isMultipleStyles.value ? multipleStyleOptions.value.length > 0 : classNamesSelect.options.value.length > 1,
)

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
      classNamesSelect.model.value = null
    })
  })

  watchEffect(() => {
    uiSelect.options.value = uiOptions.value
    classNamesSelect.options.value = classOptions.value
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
          :options="multipleStyleOptions"
          multiple
          placeholder="Default"
        />
        <CwaUiSelect
          v-else
          v-model="classNamesSelect.model.value"
          :options="classNamesSelect.options.value"
        />
      </CwaUiFormLabelWrapper>
    </div>
  </div>
</template>
